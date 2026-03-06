"""
QA Test Script - Modulos Ventas y Compras
App: http://localhost:3001
"""
import os
import sys
import io
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright, Page, ConsoleMessage

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
BASE_URL = "http://localhost:3001"

RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):      print(f"  {GREEN}[OK]{RESET} {msg}")
def fail(msg):    print(f"  {RED}[FAIL]{RESET} {msg}")
def info(msg):    print(f"  {BLUE}[..]{RESET} {msg}")
def warn(msg):    print(f"  {YELLOW}[WARN]{RESET} {msg}")
def section(msg): print(f"\n{BOLD}{BLUE}{'='*60}{RESET}\n{BOLD}  {msg}{RESET}\n{'='*60}")

bugs = {"ventas": [], "compras": [], "general": []}
screenshots = []
console_errors = []


def report_bug(module, description, severity="MEDIUM"):
    entry = f"[{severity}] {description}"
    bugs[module].append(entry)
    print(f"  {RED}BUG ({severity}){RESET}: {description}")


def take_screenshot(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    try:
        page.screenshot(path=path, full_page=True)
        screenshots.append(path)
        info(f"Screenshot guardado: {name}.png")
    except Exception as e:
        warn(f"No se pudo tomar screenshot '{name}': {e}")
    return path


def on_console(msg):
    if msg.type in ("error", "warning"):
        entry = {
            "type": msg.type,
            "text": msg.text,
            "url": msg.location.get("url", "") if msg.location else "",
            "line": msg.location.get("lineNumber", "") if msg.location else "",
        }
        if msg.type == "error":
            console_errors.append(entry)
            text = msg.text.lower()
            skip_patterns = ["favicon", "net::err_aborted"]
            if not any(p in text for p in skip_patterns):
                print(f"  {RED}[CONSOLE ERROR]{RESET} {msg.text[:200]}")


def do_login(page):
    section("LOGIN")
    info(f"Navegando a {BASE_URL}")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    take_screenshot(page, "01_home")

    current = page.url
    info(f"URL actual: {current}")

    if "/login" in current:
        ok("Pagina de login detectada correctamente")
        email_sel = 'input[type="email"], input[name="email"]'
        pass_sel = 'input[type="password"], input[name="password"]'
        page.wait_for_selector(email_sel, timeout=8000)
        page.fill(email_sel, "luxassilva@gmail.com")
        page.fill(pass_sel, "admin123")
        take_screenshot(page, "02_login_filled")
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        take_screenshot(page, "03_post_login")
        ok(f"Login completado -> {page.url}")
    else:
        warn("No redirigio - no a /login, posiblemente ya autenticado")

    if "/onboarding" in page.url:
        info("Detectado /onboarding, ejecutando bypass...")
        page.evaluate("async () => { await fetch('/api/auth/complete-onboarding', { method: 'POST' }); }")
        page.wait_for_timeout(800)
        page.goto(BASE_URL + "/ventas")
        page.wait_for_load_state("networkidle")
        ok("Onboarding bypass ejecutado")

    take_screenshot(page, "04_after_login")
    return page.url


def test_ventas(page):
    section("TEST MODULO: VENTAS (/ventas)")

    page.goto(BASE_URL + "/ventas")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    take_screenshot(page, "05_ventas_inicial")

    info(f"URL: {page.url}")
    if "/ventas" not in page.url:
        report_bug("ventas", f"Redirigio a {page.url} en lugar de /ventas", "HIGH")

    # Titulo
    try:
        page.locator("h1, h2").filter(has_text="Ventas").first.wait_for(timeout=5000)
        ok("Titulo 'Ventas' encontrado")
    except Exception:
        report_bug("ventas", "No se encontro el titulo 'Ventas' en la pagina", "MEDIUM")

    # Boton Nueva Venta
    try:
        page.get_by_role("button", name="Nueva Venta").wait_for(timeout=5000)
        ok("Boton 'Nueva Venta' presente")
    except Exception:
        report_bug("ventas", "Boton '+ Nueva Venta' no encontrado", "HIGH")

    # Boton Cobros pendientes
    try:
        page.get_by_role("button", name="Cobros pendientes").wait_for(timeout=3000)
        ok("Boton 'Cobros pendientes' presente")
    except Exception:
        report_bug("ventas", "Boton 'Cobros pendientes' no encontrado", "MEDIUM")

    # Exportar CSV
    try:
        btn_csv = page.get_by_role("button", name="Exportar CSV")
        btn_csv.wait_for(timeout=3000)
        ok("Boton 'Exportar CSV' presente")
        if btn_csv.is_disabled():
            ok("'Exportar CSV' correctamente deshabilitado (sin datos)")
        else:
            warn("'Exportar CSV' esta habilitado -- hay datos en la tabla")
    except Exception:
        report_bug("ventas", "Boton 'Exportar CSV' no encontrado", "MEDIUM")

    # Filtros de fecha
    try:
        count = page.locator('input[type="date"]').count()
        if count >= 2:
            ok(f"Filtros de fecha encontrados ({count} inputs)")
        else:
            report_bug("ventas", f"Solo {count} input de fecha, se esperan 2 (Desde/Hasta)", "MEDIUM")
    except Exception as e:
        report_bug("ventas", f"Error buscando filtros de fecha: {e}", "MEDIUM")

    # Selector estado
    try:
        page.locator('[role="combobox"]').first.wait_for(timeout=3000)
        ok("Selector de estado presente")
    except Exception:
        report_bug("ventas", "Selector de estado no encontrado", "MEDIUM")

    # Toggle filtro pendientes
    try:
        btn_pending = page.get_by_role("button", name="Cobros pendientes")
        btn_pending.click()
        page.wait_for_timeout(800)
        ok("Click en 'Cobros pendientes' ejecutado sin error")
        take_screenshot(page, "06_ventas_filtro_pendientes")
        btn_pending.click()
        page.wait_for_timeout(500)
        ok("Filtro desactivado correctamente")
    except Exception as e:
        report_bug("ventas", f"Error al usar filtro 'Cobros pendientes': {e}", "MEDIUM")

    # Filtro fecha
    try:
        date_from = page.locator('input[type="date"]').first
        date_from.fill("2025-01-01")
        page.wait_for_timeout(600)
        take_screenshot(page, "07_ventas_filtro_fecha")
        ok("Filtro 'Desde' aplicado")
        try:
            limpiar = page.get_by_role("button", name="Limpiar filtros")
            limpiar.wait_for(timeout=2000)
            ok("Boton 'Limpiar filtros' aparece")
            limpiar.click()
            page.wait_for_timeout(400)
        except Exception:
            report_bug("ventas", "Boton 'Limpiar filtros' no aparece tras filtro de fecha", "LOW")
    except Exception as e:
        report_bug("ventas", f"Error al probar filtro de fecha: {e}", "MEDIUM")

    # Modal Nueva Venta
    info("Abriendo modal 'Nueva Venta'...")
    try:
        page.get_by_role("button", name="Nueva Venta").click()
        page.wait_for_timeout(1200)
        take_screenshot(page, "08_ventas_modal_abierto")

        dialog = page.locator('[role="dialog"]')
        dialog.wait_for(timeout=5000)
        ok("Modal 'Nueva Venta' abierto")

        for field_name, selector in [
            ("Producto (select)", '[data-radix-select-trigger]'),
            ("Cantidad", '#quantity'),
            ("Precio Unitario", '#unitPrice'),
        ]:
            try:
                dialog.locator(selector).first.wait_for(timeout=3000)
                ok(f"Campo '{field_name}' presente")
            except Exception:
                report_bug("ventas", f"Campo '{field_name}' no encontrado en formulario Nueva Venta", "HIGH")

        try:
            dialog.locator("text=Cobros").first.wait_for(timeout=3000)
            ok("Seccion 'Cobros' presente en modal")
        except Exception:
            report_bug("ventas", "Seccion 'Cobros' no encontrada en 
