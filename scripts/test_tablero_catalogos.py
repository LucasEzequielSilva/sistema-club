"""
QA Test Script: Tablero + Catalogos
App: http://localhost:3001
"""

import os
import time
from playwright.sync_api import sync_playwright, ConsoleMessage

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

BASE_URL = "http://localhost:3001"
EMAIL = "luxassilva@gmail.com"
PASSWORD = "admin123"

console_errors = []
bugs = []
screenshots_taken = []


def ss(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    screenshots_taken.append(path)
    print(f"  [screenshot] {name}.png")
    return path


def log_bug(module, severity, description, detail=""):
    entry = {
        "module": module,
        "severity": severity,
        "description": description,
        "detail": detail,
    }
    bugs.append(entry)
    print(f"  [BUG][{severity}] {module}: {description}")
    if detail:
        print(f"           detail: {detail}")


def on_console(msg: ConsoleMessage):
    if msg.type in ("error", "warning"):
        console_errors.append({"type": msg.type, "text": msg.text})
        print(f"  [CONSOLE {msg.type.upper()}] {msg.text[:200]}")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", on_console)

        # ─────────────────────────────────────────
        # 1. LOGIN
        # ─────────────────────────────────────────
        print("\n=== LOGIN ===")
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        ss(page, "01_landing")

        current_url = page.url
        print(f"  URL after initial load: {current_url}")

        # Detectar si hay formulario de login
        if page.locator("input[type='email'], input[name='email']").count() > 0:
            print("  Login form detected - filling credentials")
            email_input = page.locator("input[type='email'], input[name='email']").first
            email_input.fill(EMAIL)

            pwd_input = page.locator(
                "input[type='password'], input[name='password']"
            ).first
            pwd_input.fill(PASSWORD)

            ss(page, "02_login_filled")

            # Submit
            submit = page.locator("button[type='submit']").first
            submit.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
        else:
            print(
                "  No login form visible - might be already logged in or different flow"
            )

        current_url = page.url
        print(f"  URL after login: {current_url}")
        ss(page, "03_after_login")

        # ─────────────────────────────────────────
        # 2. BYPASS ONBOARDING
        # ─────────────────────────────────────────
        if "/onboarding" in current_url:
            print("\n=== ONBOARDING BYPASS ===")
            print("  Onboarding detected - bypassing via API")
            page.evaluate(
                "async () => { await fetch('/api/auth/complete-onboarding', { method: 'POST' }); }"
            )
            page.wait_for_timeout(800)
            page.goto(f"{BASE_URL}/tablero")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            current_url = page.url
            print(f"  URL after bypass: {current_url}")
            ss(page, "04_after_onboarding_bypass")

        # ─────────────────────────────────────────
        # 3. TEST TABLERO
        # ─────────────────────────────────────────
        print("\n=== TEST TABLERO (/tablero) ===")
        page.goto(f"{BASE_URL}/tablero")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        current_url = page.url
        print(f"  URL: {current_url}")
        ss(page, "05_tablero_full")

        # Verificar si hay SetupChecklist o dashboard completo
        page_content = page.content()
        page_text = page.inner_text("body")

        # Detectar SetupChecklist
        checklist_keywords = [
            "setup",
            "checklist",
            "empezar",
            "configurar",
            "primeros pasos",
            "bienvenido",
        ]
        has_checklist = any(kw in page_text.lower() for kw in checklist_keywords)

        dashboard_keywords = [
            "ventas",
            "ingresos",
            "pedidos",
            "estadísticas",
            "hoy",
            "este mes",
        ]
        has_dashboard = any(kw in page_text.lower() for kw in dashboard_keywords)

        print(f"  Has SetupChecklist indicators: {has_checklist}")
        print(f"  Has Dashboard indicators: {has_dashboard}")

        if has_checklist and not has_dashboard:
            print("  -> Showing SETUP CHECKLIST (onboarding not complete)")
            ss(page, "06_tablero_setup_checklist")

            # Contar pasos completados
            # Buscar checkmarks o íconos de completado
            check_elements = page.locator(
                "[data-state='checked'], .checked, [aria-checked='true']"
            ).all()
            completed_count = len(check_elements)
            print(f"  Pasos completados encontrados: {completed_count}")

            # Buscar items de checklist
            checklist_items = page.locator("li, [role='listitem']").all()
            print(f"  Total items de lista: {len(checklist_items)}")

            log_bug(
                "Tablero",
                "INFO",
                "SetupChecklist visible en lugar del dashboard",
                f"Pasos completados: {completed_count}",
            )
        else:
            print("  -> Showing FULL DASHBOARD")
            ss(page, "06_tablero_dashboard")

            # Verificar StatCards
            stat_cards = page.locator(
                "[class*='card'], [class*='stat'], [class*='metric']"
            ).all()
            print(f"  StatCards encontradas: {len(stat_cards)}")
            if len(stat_cards) == 0:
                log_bug(
                    "Tablero", "HIGH", "No se encontraron StatCards en el dashboard"
                )

            # Verificar gráficos
            charts = page.locator(
                "canvas, svg[class*='chart'], [class*='recharts'], [class*='chart']"
            ).all()
            print(f"  Gráficos encontrados: {len(charts)}")

            # Verificar tablas
            tables = page.locator("table, [role='table']").all()
            print(f"  Tablas encontradas: {len(tables)}")

        # Probar filtros de período
        print("\n  -- Filtros de período --")
        period_filters = [
            "Hoy",
            "Este mes",
            "Esta semana",
            "Ayer",
            "Últimos 7 días",
            "Últimos 30 días",
        ]
        filters_found = []
        for pf in period_filters:
            btns = page.locator(
                f"button:has-text('{pf}'), [role='tab']:has-text('{pf}'), a:has-text('{pf}')"
            ).all()
            if btns:
                filters_found.append(pf)
                print(f"  Filter '{pf}' found ({len(btns)} elements)")

        if filters_found:
            # Intentar clickear el primer filtro
            try:
                btn = page.locator(
                    f"button:has-text('{filters_found[0]}'), [role='tab']:has-text('{filters_found[0]}')"
                ).first
                btn.click()
                page.wait_for_timeout(800)
                ss(page, "07_tablero_filter_active")
                print(f"  Clicked filter: {filters_found[0]}")
            except Exception as e:
                log_bug(
                    "Tablero",
                    "MEDIUM",
                    f"No se pudo clickear filtro '{filters_found[0]}'",
                    str(e),
                )
        else:
            print("  No period filters found")
            log_bug(
                "Tablero",
                "MEDIUM",
                "No se encontraron filtros de período en el tablero",
            )

        # Verificar widget Clubi (ícono flotante)
        print("\n  -- Widget Clubi --")
        clubi_selectors = [
            "[class*='clubi']",
            "[class*='chat']",
            "[class*='float']",
            "[aria-label*='clubi' i]",
            "[aria-label*='chat' i]",
            "button[class*='fixed']",
        ]
        clubi_found = False
        for sel in clubi_selectors:
            elements = page.locator(sel).all()
            if elements:
                print(
                    f"  Clubi widget found with selector: {sel} ({len(elements)} elements)"
                )
                clubi_found = True
                break
        if not clubi_found:
            print("  Clubi widget not found")
            log_bug("Tablero", "LOW", "Widget 'Clubi' (ícono flotante) no encontrado")

        # ─────────────────────────────────────────
        # 4. TEST PRODUCTOS
        # ─────────────────────────────────────────
        print("\n=== TEST PRODUCTOS (/productos) ===")
        page.goto(f"{BASE_URL}/productos")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        current_url = page.url
        print(f"  URL: {current_url}")
        if "/productos" not in current_url:
            log_bug("Productos", "HIGH", f"Redirección inesperada a {current_url}")

        ss(page, "08_productos_full")

        # Verificar tabla de productos
        table_rows = page.locator("table tbody tr, [role='row']").all()
        print(f"  Filas en tabla: {len(table_rows)}")
        if len(table_rows) == 0:
            # Verificar empty state
            empty_text = page.locator(
                "[class*='empty'], [class*='no-data'], [class*='sin-']"
            ).all()
            if empty_text:
                print("  Empty state displayed")
                log_bug("Productos", "INFO", "Tabla de productos vacía (empty state)")
            else:
                log_bug(
                    "Productos",
                    "MEDIUM",
                    "Tabla de productos vacía sin empty state visible",
                )

        # Intentar abrir "Nuevo Producto"
        print("\n  -- Nuevo Producto dialog --")
        nuevo_btn_selectors = [
            "button:has-text('Nuevo producto')",
            "button:has-text('Nuevo Producto')",
            "button:has-text('Agregar producto')",
            "button:has-text('Agregar Producto')",
            "button:has-text('+ Producto')",
            "button:has-text('Crear producto')",
            "a:has-text('Nuevo producto')",
            "[class*='nuevo'] button",
        ]
        nuevo_btn = None
        for sel in nuevo_btn_selectors:
            elements = page.locator(sel).all()
            if elements:
                nuevo_btn = page.locator(sel).first
                print(f"  'Nuevo Producto' button found: {sel}")
                break

        if nuevo_btn:
            try:
                nuevo_btn.click()
                page.wait_for_timeout(1000)
                ss(page, "09_productos_nuevo_form")

                # Verificar que abrió formulario/modal
                modal = page.locator(
                    "[role='dialog'], [class*='modal'], [class*='sheet'], [class*='drawer']"
                ).all()
                if modal:
                    print(f"  Modal/dialog opened ({len(modal)} elements)")
                    # Verificar campos del formulario
                    inputs = page.locator("input, textarea, select").all()
                    print(f"  Inputs en formulario: {len(inputs)}")
                    if len(inputs) < 3:
                        log_bug(
                            "Productos",
                            "MEDIUM",
                            f"Formulario de nuevo producto con pocos campos ({len(inputs)} inputs)",
                        )
                else:
                    log_bug(
                        "Productos",
                        "HIGH",
                        "Al clickear 'Nuevo Producto' no se abrió ningún modal/dialog",
                    )

                # Cerrar sin guardar
                close_selectors = [
                    "button[aria-label='Close']",
                    "button[aria-label='Cerrar']",
                    "button:has-text('Cancelar')",
                    "button:has-text('Cancel')",
                    "[data-radix-collection-item]",
                    "button[class*='close']",
                    "[class*='close-button']",
                ]
                closed = False
                for csel in close_selectors:
                    close_btns = page.locator(csel).all()
                    if close_btns:
                        page.locator(csel).first.click()
                        page.wait_for_timeout(500)
                        closed = True
                        print(f"  Dialog closed with: {csel}")
                        break
                if not closed:
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(500)
                    print("  Dialog closed with Escape")
            except Exception as e:
                log_bug(
                    "Productos",
                    "HIGH",
                    "Error al interactuar con 'Nuevo Producto'",
                    str(e),
                )
        else:
            log_bug("Productos", "MEDIUM", "Botón 'Nuevo Producto' no encontrado")

        ss(page, "10_productos_after_close")

        # ─────────────────────────────────────────
        # 5. TEST PROVEEDORES
        # ─────────────────────────────────────────
        print("\n=== TEST PROVEEDORES (/proveedores) ===")
        page.goto(f"{BASE_URL}/proveedores")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        current_url = page.url
        print(f"  URL: {current_url}")
        if "/proveedores" not in current_url:
            log_bug("Proveedores", "HIGH", f"Redirección inesperada a {current_url}")

        ss(page, "11_proveedores_full")

        # Verificar tabla o empty state
        prov_rows = page.locator(
            "table tbody tr, [role='row']:not([role='columnheader'])"
        ).all()
        print(f"  Filas en tabla proveedores: {len(prov_rows)}")

        prov_text = page.inner_text("body")
        if len(prov_rows) == 0:
            if any(
                k in prov_text.lower()
                for k in [
                    "no hay",
                    "sin proveedores",
                    "vacío",
                    "empty",
                    "no se encontraron",
                ]
            ):
                print("  Empty state message detected")
            else:
                log_bug("Proveedores", "MEDIUM", "Tabla vacía sin empty state claro")

        # ─────────────────────────────────────────
        # 6. TEST CLASIFICACIONES
        # ─────────────────────────────────────────
        print("\n=== TEST CLASIFICACIONES (/clasificaciones) ===")
        page.goto(f"{BASE_URL}/clasificaciones")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        current_url = page.url
        print(f"  URL: {current_url}")
        if "/clasificaciones" not in current_url:
            log_bug(
                "Clasificaciones", "HIGH", f"Redirección inesperada a {current_url}"
            )

        ss(page, "12_clasificaciones_full")

        class_text = page.inner_text("body")

        # Verificar categorías
        categorias_found = any(
            k in class_text.lower() for k in ["categor", "rubro", "tipo"]
        )
        metodos_pago_found = any(
            k in class_text.lower()
            for k in ["pago", "efectivo", "tarjeta", "transferencia"]
        )

        print(f"  Categorías encontradas: {categorias_found}")
        print(f"  Métodos de pago encontrados: {metodos_pago_found}")

        if not categorias_found:
            log_bug(
                "Clasificaciones", "MEDIUM", "No se encontraron categorías en la página"
            )
        if not metodos_pago_found:
            log_bug(
                "Clasificaciones",
                "MEDIUM",
                "No se encontraron métodos de pago en la página",
            )

        # Screenshot de cada sección si hay tabs
        tabs = page.locator("[role='tab']").all()
        if tabs:
            print(f"  Tabs encontrados: {len(tabs)}")
            for i, tab in enumerate(tabs[:4]):
                try:
                    tab_text = tab.inner_text().strip()
                    tab.click()
                    page.wait_for_timeout(600)
                    ss(
                        page,
                        f"13_clasificaciones_tab_{i}_{tab_text[:20].replace(' ', '_')}",
                    )
                    print(f"  Tab clicked: {tab_text}")
                except Exception as e:
                    print(f"  Error clicking tab {i}: {e}")

        # ─────────────────────────────────────────
        # 7. TEST SIDEBAR
        # ─────────────────────────────────────────
        print("\n=== TEST SIDEBAR ===")

        # Ir a tablero para tener el sidebar visible
        page.goto(f"{BASE_URL}/tablero")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Capturar todos los links del sidebar
        sidebar_links = page.locator(
            "nav a[href], aside a[href], [class*='sidebar'] a[href], [class*='nav'] a[href]"
        ).all()

        print(f"  Links en sidebar: {len(sidebar_links)}")

        if len(sidebar_links) == 0:
            # Intentar con selectores más amplios
            sidebar_links = page.locator("a[href^='/']").all()
            print(f"  Links con href='/...' : {len(sidebar_links)}")

        sidebar_hrefs = []
        for link in sidebar_links:
            href = link.get_attribute("href")
            if href and href.startswith("/") and href not in sidebar_hrefs:
                sidebar_hrefs.append(href)

        print(f"  Unique hrefs: {sidebar_hrefs}")

        # Navegar y verificar cada link
        failed_links = []
        for href in sidebar_hrefs[:15]:  # Limitar a primeros 15
            try:
                page.goto(f"{BASE_URL}{href}")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(500)
                final_url = page.url

                # Verificar 404
                body_text = page.inner_text("body")
                if (
                    "404" in body_text
                    or "not found" in body_text.lower()
                    or "página no encontrada" in body_text.lower()
                ):
                    failed_links.append(href)
                    log_bug("Sidebar", "HIGH", f"Link 404: {href}")
                else:
                    print(f"  OK: {href} -> {final_url}")
            except Exception as e:
                failed_links.append(href)
                log_bug("Sidebar", "HIGH", f"Error navegando a {href}", str(e))

        if failed_links:
            print(f"  Links fallidos: {failed_links}")

        # Verificar footer del sidebar con usuario
        print("\n  -- Footer del sidebar --")
        page.goto(f"{BASE_URL}/tablero")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Buscar nombre de usuario en el footer
        user_keywords = ["mati", "administrador", "admin"]
        page_text_lower = page.inner_text("body").lower()
        user_found = any(kw in page_text_lower for kw in user_keywords)
        print(f"  Usuario en footer: {user_found}")
        if not user_found:
            log_bug(
                "Sidebar",
                "MEDIUM",
                "No se encontró el usuario 'Mati / Administrador' en el footer del sidebar",
            )

        # Screenshot sidebar con footer
        ss(page, "14_sidebar_footer")

        # Verificar botón logout - hover sobre footer
        print("\n  -- Botón Logout --")
        footer_selectors = [
            "[class*='sidebar'] [class*='footer']",
            "[class*='nav-footer']",
            "[class*='user']",
            "nav footer",
        ]
        footer_el = None
        for fsel in footer_selectors:
            els = page.locator(fsel).all()
            if els:
                footer_el = page.locator(fsel).first
                break

        if footer_el:
            try:
                footer_el.hover()
                page.wait_for_timeout(600)
                ss(page, "15_sidebar_footer_hover")
                print("  Footer hover done")

                # Buscar logout button after hover
                logout_selectors = [
                    "button:has-text('Cerrar sesión')",
                    "button:has-text('Salir')",
                    "button:has-text('Logout')",
                    "button:has-text('Log out')",
                    "[aria-label*='logout' i]",
                    "[aria-label*='cerrar sesión' i]",
                ]
                logout_found = False
                for lsel in logout_selectors:
                    if page.locator(lsel).count() > 0:
                        print(f"  Logout button found: {lsel}")
                        logout_found = True
                        break
                if not logout_found:
                    print("  Logout button not visible after hover")
                    log_bug(
                        "Sidebar",
                        "LOW",
                        "Botón logout no visible después de hover en footer",
                    )
            except Exception as e:
                log_bug(
                    "Sidebar",
                    "MEDIUM",
                    "Error al hacer hover en el footer del sidebar",
                    str(e),
                )
        else:
            log_bug("Sidebar", "LOW", "No se encontró el footer del sidebar")

        # ─────────────────────────────────────────
        # EXTRA: Páginas adicionales del menú
        # ─────────────────────────────────────────
        print("\n=== EXTRA: Páginas adicionales ===")
        extra_pages = [
            ("/ventas", "ventas"),
            ("/clientes", "clientes"),
            ("/compras", "compras"),
        ]
        for path, name in extra_pages:
            try:
                page.goto(f"{BASE_URL}{path}")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(800)
                body = page.inner_text("body")
                is_404 = "404" in body or "not found" in body.lower()
                print(f"  {path}: {'404/Error' if is_404 else 'OK'}")
                ss(page, f"16_{name}_full")
                if is_404:
                    log_bug(name.capitalize(), "HIGH", f"Página {path} devuelve 404")
            except Exception as e:
                print(f"  Error: {path}: {e}")

        # ─────────────────────────────────────────
        # FINAL SCREENSHOT
        # ─────────────────────────────────────────
        page.goto(f"{BASE_URL}/tablero")
        page.wait_for_load_state("networkidle")
        ss(page, "99_final_tablero")

        browser.close()

    # ─────────────────────────────────────────
    # REPORTE FINAL
    # ─────────────────────────────────────────
    print("\n" + "=" * 60)
    print("REPORTE FINAL DE QA")
    print("=" * 60)

    print(f"\nScreenshots tomados ({len(screenshots_taken)}):")
    for s in screenshots_taken:
        print(f"  - {os.path.basename(s)}")

    print(f"\nErrores de consola JS ({len(console_errors)}):")
    if console_errors:
        for e in console_errors:
            print(f"  [{e['type'].upper()}] {e['text'][:300]}")
    else:
        print("  Ninguno detectado")

    print(f"\nBugs y UX Issues ({len(bugs)}):")
    if bugs:
        by_module = {}
        for b in bugs:
            m = b["module"]
            by_module.setdefault(m, []).append(b)
        for module, issues in by_module.items():
            print(f"\n  [{module}]")
            for i in issues:
                detail_str = f" | {i['detail']}" if i["detail"] else ""
                print(f"    [{i['severity']}] {i['description']}{detail_str}")
    else:
        print("  Ninguno detectado")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    run()
