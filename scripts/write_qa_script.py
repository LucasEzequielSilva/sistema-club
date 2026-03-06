"""Helper: generates the QA test script as pure ASCII"""

import os

SCRIPT = r"""import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
BASE_URL = 'http://localhost:3001'
RED='\033[91m'; GREEN='\033[92m'; YELLOW='\033[93m'; BLUE='\033[94m'; BOLD='\033[1m'; RESET='\033[0m'
def ok(m): print(f'  {GREEN}[OK]{RESET} {m}')
def info(m): print(f'  {BLUE}[..]{RESET} {m}')
def warn(m): print(f'  {YELLOW}[WARN]{RESET} {m}')
def section(m): print(f'\n{BOLD}{BLUE}' + '='*60 + f'{RESET}\n{BOLD}  {m}{RESET}\n' + '='*60)

bugs = {'ventas': [], 'compras': [], 'general': []}
screenshots = []
console_errors = []

def report_bug(mod, desc, sev='MEDIUM'):
    entry = f'[{sev}] {desc}'
    bugs[mod].append(entry)
    print(f'  {RED}BUG ({sev}){RESET}: {desc}')

def ss(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f'{name}.png')
    try:
        page.screenshot(path=path, full_page=True)
        screenshots.append(path)
        info(f'Screenshot: {name}.png')
    except Exception as e:
        warn(f'Screenshot failed: {e}')

def on_console(msg):
    if msg.type == 'error':
        entry = {
            'type': msg.type, 'text': msg.text,
            'url': (msg.location or {}).get('url', ''),
            'line': (msg.location or {}).get('lineNumber', '')
        }
        console_errors.append(entry)
        t = msg.text.lower()
        if 'favicon' not in t and 'err_aborted' not in t:
            print(f'  {RED}[CONSOLE ERROR]{RESET} {msg.text[:200]}')

def do_login(page):
    section('LOGIN')
    info(f'Navegando a {BASE_URL}')
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    ss(page, '01_home')
    info(f'URL: {page.url}')
    if '/login' in page.url:
        ok('Pagina de login detectada')
        page.wait_for_selector('input[type="email"]', timeout=8000)
        page.fill('input[type="email"]', 'luxassilva@gmail.com')
        page.fill('input[type="password"]', 'admin123')
        ss(page, '02_login_filled')
        page.click('button[type="submit"]')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        ss(page, '03_post_login')
        ok(f'Login -> {page.url}')
    else:
        warn('No redirigió a /login')
    if '/onboarding' in page.url:
        info('Bypass onboarding...')
        page.evaluate("async () => { await fetch('/api/auth/complete-onboarding', { method: 'POST' }); }")
        page.wait_for_timeout(800)
        page.goto(BASE_URL + '/ventas')
        page.wait_for_load_state('networkidle')
        ok('Onboarding bypass OK')
    ss(page, '04_after_login')

def test_ventas(page):
    section('TEST VENTAS (/ventas)')
    page.goto(BASE_URL + '/ventas')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    ss(page, '05_ventas_inicial')
    info(f'URL: {page.url}')
    if '/ventas' not in page.url:
        report_bug('ventas', f'Redirigió a {page.url} en lugar de /ventas', 'HIGH')

    # Titulo
    try:
        page.locator('h1, h2').filter(has_text='Ventas').first.wait_for(timeout=5000)
        ok('Titulo Ventas encontrado')
    except Exception:
        report_bug('ventas', 'Titulo Ventas no encontrado', 'MEDIUM')

    # Boton Nueva Venta
    try:
        page.get_by_role('button', name='Nueva Venta').wait_for(timeout=5000)
        ok('Boton Nueva Venta presente')
    except Exception:
        report_bug('ventas', 'Boton Nueva Venta no encontrado', 'HIGH')

    # Boton Cobros pendientes
    try:
        page.get_by_role('button', name='Cobros pendientes').wait_for(timeout=3000)
        ok('Boton Cobros pendientes presente')
    except Exception:
        report_bug('ventas', 'Boton Cobros pendientes no encontrado', 'MEDIUM')

    # Exportar CSV
    try:
        btn_csv = page.get_by_role('button', name='Exportar CSV')
        btn_csv.wait_for(timeout=3000)
        ok('Boton Exportar CSV presente')
        if btn_csv.is_disabled():
            ok('Exportar CSV deshabilitado (sin datos - correcto)')
        else:
            warn('Exportar CSV habilitado - hay datos')
    except Exception:
        report_bug('ventas', 'Boton Exportar CSV no encontrado', 'MEDIUM')

    # Filtros fecha
    cnt = page.locator('input[type="date"]').count()
    if cnt >= 2:
        ok(f'Filtros fecha: {cnt} inputs encontrados')
    else:
        report_bug('ventas', f'Solo {cnt} input fecha, se esperan 2 (Desde/Hasta)', 'MEDIUM')

    # Selector estado
    try:
        page.locator('[role="combobox"]').first.wait_for(timeout=3000)
        ok('Selector estado presente')
    except Exception:
        report_bug('ventas', 'Selector estado no encontrado', 'MEDIUM')

    # Toggle filtro pendientes
    try:
        btn = page.get_by_role('button', name='Cobros pendientes')
        btn.click()
        page.wait_for_timeout(800)
        ok('Click Cobros pendientes sin error')
        ss(page, '06_ventas_filtro_pendientes')
        btn.click()
        page.wait_for_timeout(500)
        ok('Filtro desactivado')
    except Exception as e:
        report_bug('ventas', f'Error filtro Cobros pendientes: {e}', 'MEDIUM')

    # Filtro fecha
    try:
        page.locator('input[type="date"]').first.fill('2025-01-01')
        page.wait_for_timeout(600)
        ss(page, '07_ventas_filtro_fecha')
        ok('Filtro Desde aplicado')
        try:
            page.get_by_role('button', name='Limpiar filtros').wait_for(timeout=2000)
            ok('Boton Limpiar filtros aparece')
            page.get_by_role('button', name='Limpiar filtros').click()
            page.wait_for_timeout(400)
            ok('Filtros limpiados')
        except Exception:
            report_bug('ventas', 'Boton Limpiar filtros no aparece tras filtro de fecha', 'LOW')
    except Exception as e:
        report_bug('ventas', f'Error filtro fecha: {e}', 'MEDIUM')

    # Modal Nueva Venta
    info('Abriendo modal Nueva Venta...')
    try:
        page.get_by_role('button', name='Nueva Venta').click()
        page.wait_for_timeout(1200)
        ss(page, '08_ventas_modal_abierto')
        dlg = page.locator('[role="dialog"]')
        dlg.wait_for(timeout=5000)
        ok('Modal Nueva Venta abierto')

        for fname, sel in [
            ('Producto (select)', '[data-radix-select-trigger]'),
            ('Cantidad', '#quantity'),
            ('Precio Unitario', '#unitPrice'),
            ('Descuento %', '#discountPct'),
        ]:
            try:
                dlg.locator(sel).first.wait_for(timeout=3000)
                ok(f'Campo {fname} presente')
            except Exception:
                report_bug('ventas', f'Campo {fname} no encontrado en form Nueva Venta', 'HIGH')

        try:
            dlg.locator('text=Cobros').first.wait_for(timeout=3000)
            ok('Seccion Cobros presente')
        except Exception:
            report_bug('ventas', 'Seccion Cobros no encontrada en modal', 'MEDIUM')

        try:
            dlg.get_by_role('button', name='Agregar Cobro').wait_for(timeout=3000)
            ok('Boton Agregar Cobro presente')
        except Exception:
            report_bug('ventas', 'Boton Agregar Cobro no encontrado', 'MEDIUM')

        try:
            dlg.locator('text=Preview').first.wait_for(timeout=2000)
            ok('Seccion Preview (calculo en vivo) presente')
        except Exception:
            report_bug('ventas', 'Seccion Preview no encontrada en modal', 'LOW')

        # Validacion vacia
        info('Test validacion submit vacio...')
        dlg.get_by_role('button', name='Guardar').click()
        page.wait_for_timeout(1000)
        ss(page, '09_ventas_validacion_vacia')
        try:
            toast = page.locator('[data-sonner-toast]').first
            toast.wait_for(timeout=2000)
            ok(f'Toast validacion: {toast.text_content()[:80]}')
        except Exception:
            ok('Submit vacio: HTML5 native validation (sin toast visible)')

        # Agregar cobro
        try:
            dlg.get_by_role('button', name='Agregar Cobro').click()
            page.wait_for_timeout(600)
            ss(page, '10_ventas_cobro_agregado')
            ok('Fila cobro agregada')
        except Exception as e:
            report_bug('ventas', f'Error agregando cobro: {e}', 'MEDIUM')

        dlg.get_by_role('button', name='Cancelar').click()
        page.wait_for_timeout(600)
        ok('Modal cerrado')
        ss(page, '11_ventas_modal_cerrado')

    except Exception as e:
        report_bug('ventas', f'Error critico modal Nueva Venta: {e}', 'CRITICAL')
        ss(page, '11_ventas_error_modal')

    # Tabla o empty state
    table = page.locator('table')
    if table.count() > 0:
        rows = table.locator('tbody tr')
        rc = rows.count()
        info(f'Tabla ventas: {rc} filas')
        ok('Tabla de ventas renderizada')
        ss(page, '12_ventas_tabla')
        if rc > 0:
            try:
                rows.first.get_by_role('button').first.click()
                page.wait_for_timeout(500)
                ss(page, '13_ventas_dropdown')
                items = page.locator('[role="menuitem"]')
                ic = items.count()
                ok(f'Dropdown: {ic} opciones')
                for it in ['Ver detalle', 'Agregar cobro', 'Eliminar']:
                    found = any(it in (items.nth(i).text_content() or '') for i in range(ic))
                    if found:
                        ok(f'  Item {it} presente')
                    else:
                        report_bug('ventas', f'Item {it} NO en dropdown de acciones', 'MEDIUM')
                page.keyboard.press('Escape')
                page.wait_for_timeout(300)
            except Exception as e:
                report_bug('ventas', f'Error dropdown: {e}', 'LOW')
    else:
        if page.locator('text=Tu primera venta te espera').count() > 0:
            ok('Empty state correcto: Tu primera venta te espera')
        else:
            warn('Sin tabla y sin empty state reconocible')
        ss(page, '12_ventas_empty_state')

    ss(page, '14_ventas_final')
    ok('==> Test Ventas COMPLETADO')


def test_compras(page):
    section('TEST COMPRAS (/compras)')
    page.goto(BASE_URL + '/compras')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    ss(page, '15_compras_inicial')
    info(f'URL: {page.url}')
    if '/compras' not in page.url:
        report_bug('compras', f'Redirigió a {page.url} en lugar de /compras', 'HIGH')

    try:
        page.locator('h1, h2').filter(has_text='Compras').first.wait_for(timeout=5000)
        ok('Titulo Compras encontrado')
    except Exception:
        report_bug('compras', 'Titulo Compras no encontrado', 'MEDIUM')

    try:
        page.get_by_role('button', name='Nueva Compra').wait_for(timeout=5000)
        ok('Boton Nueva Compra presente')
    except Exception:
        report_bug('compras', 'Boton Nueva Compra no encontrado', 'HIGH')

    try:
        btn_csv = page.get_by_role('button', name='Exportar CSV')
        btn_csv.wait_for(timeout=3000)
        ok('Boton Exportar CSV presente')
        if btn_csv.is_disabled():
            ok('Exportar CSV deshabilitado sin datos (correcto)')
    except Exception:
        report_bug('compras', 'Boton Exportar CSV no encontrado', 'MEDIUM')

    try:
        page.locator('input[placeholder*="Buscar"]').wait_for(timeout=3000)
        ok('Campo busqueda presente (feature de Compras)')
    except Exception:
        report_bug('compras', 'Campo busqueda no encontrado', 'MEDIUM')

    cnt = page.locator('input[type="date"]').count()
    if cnt >= 2:
        ok(f'Filtros fecha: {cnt} inputs')
    else:
        report_bug('compras', f'Solo {cnt} input fecha, se esperan 2', 'MEDIUM')

    try:
        page.locator('[role="combobox"]').first.wait_for(timeout=3000)
        ok('Selector estado presente')
    except Exception:
        report_bug('compras', 'Selector estado no encontrado', 'MEDIUM')

    # Probar busqueda
    try:
        s = page.locator('input[placeholder*="Buscar"]').first
        s.fill('test')
        page.wait_for_timeout(700)
        ss(page, '16_compras_busqueda')
        ok('Busqueda sin error JS')
        try:
            page.get_by_role('button', name='Limpiar filtros').wait_for(timeout=2000)
            ok('Boton Limpiar filtros aparece')
            page.get_by_role('button', name='Limpiar filtros').click()
            page.wait_for_timeout(400)
        except Exception:
            report_bug('compras', 'Boton Limpiar filtros no aparece tras busqueda', 'LOW')
    except Exception as e:
        report_bug('compras', f'Error busqueda: {e}', 'MEDIUM')

    # Modal Nueva Compra
    info('Abriendo modal Nueva Compra...')
    try:
        page.get_by_role('button', name='Nueva Compra').click()
        page.wait_for_timeout(1200)
        ss(page, '17_compras_modal_abierto')
        dlg = page.locator('[role="dialog"]')
        dlg.wait_for(timeout=5000)
        ok('Modal Nueva Compra abierto')

        try:
            dlg.locator('text=Nueva Compra').first.wait_for(timeout=2000)
            ok('Titulo Nueva Compra en dialog')
        except Exception:
            report_bug('compras', 'Titulo Nueva Compra no en dialog', 'MEDIUM')

        for fname, sel in [
            ('Proveedor (select)', '[data-radix-select-trigger]'),
            ('Fecha Factura', '#invoiceDate'),
            ('Cantidad', '#quantity'),
            ('Costo Unitario', '#unitCost'),
            ('IVA', '#ivaAmount'),
        ]:
            try:
                dlg.locator(sel).first.wait_for(timeout=3000)
                ok(f'Campo {fname} presente')
            except Exception:
                report_bug('compras', f'Campo {fname} no encontrado', 'HIGH')

        try:
            dlg.locator('text=Clasificaci').first.wait_for(timeout=3000)
            ok('Label Clasificacion de Costo presente (obligatorio)')
        except Exception:
            report_bug('compras', 'Label Clasificacion de Costo no encontrado', 'HIGH')

        try:
            dlg.locator('text=Pagos').first.wait_for(timeout=3000)
            ok('Seccion Pagos presente')
        except Exception:
            report_bug('compras', 'Seccion Pagos no en modal', 'MEDIUM')

        try:
            dlg.get_by_role('button', name='Agregar Pago').wait_for(timeout=3000)
            ok('Boton Agregar Pago presente')
        except Exception:
            report_bug('compras', 'Boton Agregar Pago no encontrado', 'MEDIUM')

        try:
            dlg.locator('text=Preview').first.wait_for(timeout=2000)
            ok('Seccion Preview (calculo en vivo) presente')
        except Exception:
            report_bug('compras', 'Seccion Preview no encontrada', 'LOW')

        # Test limite 2 pagos
        info('Probando limite de 2 pagos...')
        try:
            btn_pago = dlg.get_by_role('button', name='Agregar Pago')
            btn_pago.click()
            page.wait_for_timeout(400)
            btn_pago.click()
            page.wait_for_timeout(400)
            ss(page, '18_compras_2pagos')
            if btn_pago.is_disabled():
                ok('Boton Agregar Pago deshabilitado al max 2 (correcto)')
            else:
                btn_pago.click()
                page.wait_for_timeout(600)
                try:
                    page.locator('[data-sonner-toast]').first.wait_for(timeout=2000)
                    ok('Toast limite al intentar 3er pago')
                except Exception:
                    report_bug('compras', 'Sin feedback al intentar > 2 pagos', 'LOW')
        except Exception as e:
            report_bug('compras', f'Error limite pagos: {e}', 'LOW')

        # Validacion vacia
        info('Test validacion submit vacio...')
        dlg.get_by_role('button', name='Guardar').click()
        page.wait_for_timeout(1000)
        ss(page, '19_compras_validacion_vacia')
        try:
            toast = page.locator('[data-sonner-toast]').first
            toast.wait_for(timeout=2000)
            ok(f'Toast validacion: {toast.text_content()[:80]}')
        except Exception:
            ok('Submit vacio: HTML5 native validation')

        dlg.get_by_role('button', name='Cancelar').click()
        page.wait_for_timeout(600)
        ok('Modal cerrado')
        ss(page, '20_compras_modal_cerrado')

    except Exception as e:
        report_bug('compras', f'Error critico modal Nueva Compra: {e}', 'CRITICAL')
        ss(page, '20_compras_error_modal')

    # Tabla o empty state
    table = page.locator('table')
    if table.count() > 0:
        rows = table.locator('tbody tr')
        rc = rows.count()
        info(f'Tabla compras: {rc} filas')
        ok('Tabla de compras renderizada')
        ss(page, '21_compras_tabla')
        if rc > 0:
            try:
                rows.first.get_by_role('button').first.click()
                page.wait_for_timeout(500)
                ss(page, '22_compras_dropdown')
                items = page.locator('[role="menuitem"]')
                ic = items.count()
                ok(f'Dropdown: {ic} opciones')
                for it in ['Ver detalle', 'Agregar pago', 'Eliminar']:
                    found = any(it in (items.nth(i).text_content() or '') for i in range(ic))
                    if found:
                        ok(f'  Item {it} presente')
                    else:
                        report_bug('compras', f'Item {it} NO en dropdown', 'MEDIUM')
                page.keyboard.press('Escape')
                page.wait_for_timeout(300)
            except Exception as e:
                report_bug('compras', f'Error dropdown: {e}', 'LOW')
    else:
        if page.locator('text=Sin compras registradas').count() > 0:
            ok('Empty state correcto: Sin compras registradas')
        else:
            warn('Sin tabla y sin empty state reconocible')
        ss(page, '21_compras_empty_state')

    ss(page, '23_compras_final')
    ok('==> Test Compras COMPLETADO')


def test_ui_consistency(page):
    section('TEST CONSISTENCIA UI / UX')

    # Ventas CSV
    page.goto(BASE_URL + '/ventas')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1200)
    try:
        csv = page.get_by_role('button', name='Exportar CSV')
        has_data = page.locator('table tbody tr').count() > 0
        if not has_data:
            if csv.is_disabled():
                ok('[Ventas] CSV deshabilitado sin datos (correcto)')
            else:
                report_bug('ventas', 'CSV habilitado sin datos para exportar', 'MEDIUM')
        else:
            if csv.is_enabled():
                ok('[Ventas] CSV habilitado con datos (correcto)')
            else:
                report_bug('ventas', 'CSV deshabilitado con datos en tabla', 'MEDIUM')
    except Exception as e:
        warn(f'CSV check Ventas: {e}')
    ss(page, '24_ventas_kpi_check')

    # Compras CSV
    page.goto(BASE_URL + '/compras')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1200)
    try:
        csv = page.get_by_role('button', name='Exportar CSV')
        has_data = page.locator('table tbody tr').count() > 0
        if not has_data:
            if csv.is_disabled():
                ok('[Compras] CSV deshabilitado sin datos (correcto)')
            else:
                report_bug('compras', 'CSV habilitado sin datos para exportar', 'MEDIUM')
    except Exception as e:
        warn(f'CSV check Compras: {e}')
    ss(page, '25_compras_kpi_check')

    # UX: Ventas no tiene buscador, Compras si
    page.goto(BASE_URL + '/ventas')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(800)
    if page.locator('input[placeholder*="Buscar"]').count() > 0:
        report_bug('ventas', 'Ventas tiene buscador de texto (inconsistencia vs Compras)', 'LOW')
    else:
        ok('[UX] Ventas sin busqueda de texto (diferencia intencional vs Compras)')

    ok('==> Test Consistencia UI COMPLETADO')


def print_report():
    section('REPORTE FINAL DE QA')
    total_bugs = sum(len(v) for v in bugs.values())
    total_ss = len(screenshots)
    total_errs = len(console_errors)

    print(f'\n{BOLD}' + '='*60 + RESET)
    print(f'{BOLD}  RESUMEN EJECUTIVO{RESET}')
    print('='*60)
    print(f'  Total bugs:              {RED if total_bugs > 0 else GREEN}{total_bugs}{RESET}')
    print(f'  Screenshots tomados:     {total_ss}')
    print(f'  Errores de consola JS:   {RED if total_errs > 0 else GREEN}{total_errs}{RESET}')

    for module, mb in bugs.items():
        if mb:
            print(f'\n{BOLD}{RED}BUGS - {module.upper()}:{RESET}')
            for i, bug in enumerate(mb, 1):
                c = RED if '[CRITICAL]' in bug or '[HIGH]' in bug else YELLOW if '[MEDIUM]' in bug else RESET
                print(f'  {i}. {c}{bug}{RESET}')
        else:
            print(f'\n{BOLD}{GREEN}BUGS - {module.upper()}: Ninguno encontrado{RESET}')

    print(f'\n{BOLD}SCREENSHOTS ({total_ss}):{RESET}')
    for s in screenshots:
        print(f'  - {os.path.basename(s)}')

    if console_errors:
        print(f'\n{BOLD}{RED}ERRORES CONSOLA JS ({total_errs}):{RESET}')
        for e in console_errors:
            print(f'  [{e["type"].upper()}] {e["text"][:150]}')
            if e.get('url'):
                print(f'    -> {e["url"]}:{e.get("line", "?")}')
    else:
        print(f'\n{BOLD}{GREEN}ERRORES CONSOLA JS: Ninguno{RESET}')

    print(f'\n{BOLD}' + '='*60 + RESET)
    critical = [b for bl in bugs.values() for b in bl if '[CRITICAL]' in b or '[HIGH]' in b]
    if total_bugs == 0 and total_errs == 0:
        print(f'  {GREEN}{BOLD}TODOS LOS CHECKS PASARON SIN BUGS{RESET}')
    elif critical:
        print(f'  {RED}{BOLD}HAY {len(critical)} BUG(S) CRITICOS/ALTOS{RESET}')
    else:
        print(f'  {YELLOW}{BOLD}Hay {total_bugs} bug(s) de severidad media/baja{RESET}')
    print(f'  Screenshots: {SCREENSHOTS_DIR}')
    print(BOLD + '='*60 + RESET + '\n')


def main():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    print(f'\n{BOLD}{BLUE}' + '='*60 + RESET)
    print(f'{BOLD}{BLUE}  QA TEST SUITE - VENTAS & COMPRAS{RESET}')
    print(f'{BOLD}{BLUE}  App: {BASE_URL}{RESET}')
    print(BOLD + BLUE + '='*60 + RESET)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='es-AR')
        page = ctx.new_page()
        page.on('console', on_console)
        page.on('pageerror', lambda exc: (
            console_errors.append({'type': 'pageerror', 'text': str(exc), 'url': page.url, 'line': ''}),
            print(f'  {RED}[PAGE ERROR]{RESET} {str(exc)[:200]}')
        ))
        try:
            do_login(page)
            test_ventas(page)
            test_compras(page)
            test_ui_consistency(page)
        except Exception as e:
            print(f'\n{RED}{BOLD}ERROR FATAL: {e}{RESET}')
            ss(page, 'ERROR_fatal')
            import traceback
            traceback.print_exc()
        finally:
            ctx.close()
            browser.close()

    print_report()

if __name__ == '__main__':
    main()
"""

# Verify pure ASCII
non_ascii = [c for c in SCRIPT if ord(c) > 127]
if non_ascii:
    print(f"ERROR: {len(non_ascii)} non-ASCII chars: {set(non_ascii)}")
else:
    target = os.path.join(os.path.dirname(__file__), "test_ventas_compras.py")
    with open(target, "w", encoding="ascii") as f:
        f.write(SCRIPT)
    print(f"Script written: {target} ({len(SCRIPT)} bytes, pure ASCII)")
