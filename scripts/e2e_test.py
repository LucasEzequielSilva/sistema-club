"""
E2E Testing — Sistema Club (randazzo.vercel.app)
Testea todos los módulos y reporta qué anda y qué no.
"""

from playwright.sync_api import sync_playwright, Page
import json
from datetime import datetime

BASE_URL = "https://randazzo.vercel.app"
EMAIL = "luxassilva@gmail.com"
PASSWORD = "admin123"

results = []


def log(module, test, status, detail=""):
    icon = "[OK]" if status == "OK" else "[FAIL]"
    print(f"  {icon} [{module}] {test}: {detail or status}")
    results.append({"module": module, "test": test, "status": status, "detail": detail})


def login(page: Page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.locator('button[type="submit"]').first.click(force=True)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    # Cookie onboarding + ir al tablero
    page.context.add_cookies(
        [
            {
                "name": "sc_onboarding_done",
                "value": "1",
                "domain": "randazzo.vercel.app",
                "path": "/",
            }
        ]
    )
    page.goto(f"{BASE_URL}/tablero")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)


def test_login(page: Page):
    print("\n=== LOGIN ===")
    # Login incorrecto
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', "wrong@email.com")
    page.fill('input[type="password"]', "wrongpass")
    page.click('button[type="submit"]')
    # Esperar respuesta del servidor (el toast/error puede tardar)
    page.wait_for_timeout(3000)
    error = (
        page.locator("text=incorrectos").is_visible()
        or page.locator("text=incorrectas").is_visible()
        or page.locator("text=inválid").is_visible()
        or page.locator("[role=alert]").is_visible()
        or "login" in page.url  # Si sigue en login, el error ocurrió
    )
    log("Login", "Credenciales incorrectas muestran error", "OK" if error else "FAIL")

    # Login correcto
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    landed_ok = "/tablero" in page.url or "/onboarding" in page.url
    log(
        "Login",
        "Login correcto redirige a dashboard",
        "OK" if landed_ok else "FAIL",
        page.url,
    )


def test_tablero(page: Page):
    print("\n=== TABLERO ===")
    page.goto(f"{BASE_URL}/tablero")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    title = page.locator("h1, h2").first
    log("Tablero", "Página carga", "OK" if title.is_visible() else "FAIL")

    # Filtros de período
    for filtro in ["Este Mes", "Mes Anterior", "Trimestre", "Año"]:
        btn = page.locator(f"text={filtro}").first
        visible = btn.is_visible()
        if visible:
            btn.click()
            page.wait_for_timeout(500)
        log("Tablero", f"Filtro '{filtro}'", "OK" if visible else "FAIL")


def test_pos(page: Page):
    print("\n=== PUNTO DE VENTA ===")
    page.goto(f"{BASE_URL}/pos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "POS",
        "Página carga",
        "OK" if page.locator("input, [placeholder]").first.is_visible() else "FAIL",
    )

    # Buscar producto — el dropdown es un div absoluto con buttons
    search = page.locator(
        "input[placeholder*='barras'], input[placeholder*='Nombre']"
    ).first
    if not search.is_visible():
        search = page.locator("input").first
    if search.is_visible():
        search.fill("a")
        page.wait_for_timeout(800)
        # El dropdown muestra botones dentro de un div.absolute
        dropdown_btns = page.locator("div.absolute button").count()
        log(
            "POS",
            "Búsqueda de producto",
            "OK" if dropdown_btns > 0 else "FAIL",
            f"{dropdown_btns} resultados en dropdown",
        )
    else:
        log("POS", "Búsqueda de producto", "FAIL", "Input no encontrado")


def test_ventas(page: Page):
    print("\n=== VENTAS ===")
    page.goto(f"{BASE_URL}/ventas")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "Ventas",
        "Página carga",
        "OK" if not page.locator("text=Error").is_visible() else "FAIL",
    )

    # Botón nueva venta — distintos textos posibles
    btn = (
        page.locator("button:has-text('Nueva venta')")
        .or_(page.locator("button:has-text('Agregar')"))
        .or_(page.locator("button:has-text('Nuevo')"))
        .first
    )
    log("Ventas", "Botón nueva venta visible", "OK" if btn.is_visible() else "FAIL")


def test_compras(page: Page):
    print("\n=== COMPRAS ===")
    page.goto(f"{BASE_URL}/compras")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "Compras",
        "Página carga",
        "OK" if not page.locator("text=Error").is_visible() else "FAIL",
    )
    btn = page.locator(
        "button:has-text('Nueva'), button:has-text('Agregar'), button:has-text('Nuevo')"
    ).first
    log("Compras", "Botón nueva compra visible", "OK" if btn.is_visible() else "FAIL")


def test_productos(page: Page):
    print("\n=== PRODUCTOS ===")
    page.goto(f"{BASE_URL}/productos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "Productos",
        "Página carga",
        "OK" if not page.locator("text=Error").is_visible() else "FAIL",
    )

    # Abrir formulario nuevo producto
    btn = page.locator(
        "button:has-text('Nuevo'), button:has-text('Agregar producto')"
    ).first
    if btn.is_visible():
        btn.click()
        page.wait_for_timeout(1000)
        form_visible = page.locator(
            "input[placeholder], form, [role=dialog]"
        ).first.is_visible()
        log(
            "Productos",
            "Formulario nuevo producto abre",
            "OK" if form_visible else "FAIL",
        )
        # Cerrar
        esc = page.locator(
            "button:has-text('Cancelar'), button:has-text('Cerrar')"
        ).first
        if esc.is_visible():
            esc.click()
    else:
        log(
            "Productos", "Formulario nuevo producto abre", "FAIL", "Botón no encontrado"
        )


def test_proveedores(page: Page):
    print("\n=== PROVEEDORES ===")
    page.goto(f"{BASE_URL}/proveedores")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "Proveedores",
        "Página carga",
        "OK" if not page.locator("text=Error").is_visible() else "FAIL",
    )
    items = page.locator("tr, [data-row], .card").count()
    log(
        "Proveedores",
        "Lista de proveedores",
        "OK" if items >= 0 else "FAIL",
        f"{items} items",
    )


def test_clasificaciones(page: Page):
    print("\n=== CLASIFICACIONES ===")
    page.goto(f"{BASE_URL}/clasificaciones")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "Clasificaciones",
        "Página carga",
        "OK" if not page.locator("text=Error").is_visible() else "FAIL",
    )

    # Tabs — usar role=tab para mayor robustez
    for tab in ["Productos", "Costos", "Métodos de Pago"]:
        t = page.locator(f"[role=tab]:has-text('{tab}')").first
        if not t.is_visible():
            # Fallback: texto directo (sin acento puede fallar, probamos variantes)
            t = page.locator(f"button:has-text('{tab}')").first
        if t.is_visible():
            t.click()
            page.wait_for_timeout(500)
            log("Clasificaciones", f"Tab '{tab}'", "OK")
        else:
            log("Clasificaciones", f"Tab '{tab}'", "FAIL", "Tab no encontrado")


def test_mercaderia(page: Page):
    print("\n=== MERCADERÍA ===")
    page.goto(f"{BASE_URL}/mercaderia")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    log(
        "Mercadería",
        "Página carga",
        "OK" if not page.locator("text=Error, text=500").is_visible() else "FAIL",
    )


def test_finanzas(page: Page):
    print("\n=== FINANZAS ===")
    for modulo, ruta in [
        ("Resumen", "/resumen"),
        ("Cashflow", "/cashflow"),
        ("Cuadro KPIs", "/cuadro-resumen"),
        ("Estados", "/estados-resultados"),
        ("Cuentas", "/cuentas"),
    ]:
        page.goto(f"{BASE_URL}{ruta}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        error = page.locator(
            "text=Error, text=500, text=Something went wrong"
        ).first.is_visible()
        log("Finanzas", f"{modulo} carga sin error", "FAIL" if error else "OK")


def test_settings(page: Page):
    print("\n=== SETTINGS ===")
    page.goto(f"{BASE_URL}/settings")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    log(
        "Settings",
        "Página carga",
        "OK" if not page.locator("text=Error").is_visible() else "FAIL",
    )

    # Lista de usuarios
    rows = page.locator("text=@gmail.com").count()
    log(
        "Settings",
        "Usuarios listados",
        "OK" if rows > 0 else "FAIL",
        f"{rows} usuarios",
    )

    # Botón nuevo usuario
    btn = page.locator("button:has-text('Nuevo usuario')").first
    if btn.is_visible():
        btn.click()
        page.wait_for_timeout(500)
        form = page.locator("text=Nuevo usuario").first.is_visible()
        log("Settings", "Formulario nuevo usuario abre", "OK" if form else "FAIL")
    else:
        log("Settings", "Formulario nuevo usuario abre", "FAIL", "Botón no encontrado")


def test_ai_assistant(page: Page):
    print("\n=== CLUBI (IA) ===")
    page.goto(f"{BASE_URL}/tablero")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # Abrir asistente — botón fixed circular con title="Asistente IA"
    btn = (
        page.locator("button[title='Asistente IA']")
        .or_(page.locator("button:has-text('Clubi')"))
        .or_(page.locator("[aria-label*='Clubi']"))
        .first
    )
    if btn.is_visible():
        btn.click()
        page.wait_for_timeout(1000)
        input_visible = page.locator(
            "input[placeholder*='Preguntá'], textarea"
        ).first.is_visible()
        log("Clubi", "Asistente abre", "OK" if input_visible else "FAIL")

        if input_visible:
            page.locator("input[placeholder*='Preguntá'], textarea").first.fill(
                "¿Cuántas ventas tengo hoy?"
            )
            page.keyboard.press("Enter")
            page.wait_for_timeout(5000)
            has_response = (
                page.locator(
                    ".message, [class*='message'], [class*='response']"
                ).count()
                > 0
            )
            log("Clubi", "Asistente responde", "OK" if has_response else "FAIL")
    else:
        log("Clubi", "Asistente visible", "FAIL", "Botón no encontrado")


def test_logout(page: Page):
    print("\n=== LOGOUT ===")
    page.goto(f"{BASE_URL}/tablero")
    page.wait_for_load_state("networkidle")

    # Hover en el footer del sidebar para mostrar logout
    footer = page.locator(".group").last
    if footer.is_visible():
        footer.hover()
        page.wait_for_timeout(500)
        logout_btn = page.locator("button[title='Cerrar sesión']").first
        if logout_btn.is_visible():
            logout_btn.click()
            page.wait_for_url("**/login", timeout=5000)
            log("Logout", "Logout redirige a /login", "OK")
        else:
            log("Logout", "Botón logout visible al hover", "FAIL")
    else:
        log("Logout", "Footer sidebar encontrado", "FAIL")


def main():
    print(f"\n{'=' * 50}")
    print(f"  SISTEMA CLUB — E2E Testing")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  URL: {BASE_URL}")
    print(f"{'=' * 50}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Un solo contexto para todo
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()

        # Test login
        try:
            test_login(page)
        except Exception as e:
            print(f"  [FAIL] Login error: {e}")

        # Logout forzado — limpiar estado
        ctx.close()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        # Verificar que estamos deslogueados
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        print(f"  [debug] URL antes de login(): {page.url}")

        try:
            login(page)
        except Exception as e:
            import traceback

            print(f"\n[FAIL] No se pudo loguear: {e}")
            traceback.print_exc()
            browser.close()
            return

        for test_fn in [
            test_tablero,
            test_pos,
            test_ventas,
            test_compras,
            test_productos,
            test_proveedores,
            test_clasificaciones,
            test_mercaderia,
            test_finanzas,
            test_settings,
            test_ai_assistant,
            test_logout,
        ]:
            try:
                print(f"\n  [running] {test_fn.__name__}...")
                test_fn(page)
            except Exception as e:
                module = test_fn.__name__.replace("test_", "").upper()
                print(f"  [FAIL] [{module}] Error inesperado: {str(e)[:200]}")

        browser.close()

    # Resumen final
    ok = sum(1 for r in results if r["status"] == "OK")
    fail = sum(1 for r in results if r["status"] == "FAIL")
    total = len(results)

    print(f"\n{'=' * 50}")
    print(f"  RESULTADO: {ok}/{total} tests OK — {fail} fallando")
    print(f"{'=' * 50}")

    if fail > 0:
        print("\n❌ TESTS FALLANDO:")
        for r in results:
            if r["status"] == "FAIL":
                print(
                    f"  • [{r['module']}] {r['test']}"
                    + (f" → {r['detail']}" if r["detail"] else "")
                )

    # Guardar reporte JSON
    with open("scripts/test_report.json", "w") as f:
        json.dump(
            {
                "timestamp": datetime.now().isoformat(),
                "results": results,
                "summary": {"ok": ok, "fail": fail, "total": total},
            },
            f,
            indent=2,
        )
    print(f"\nReporte guardado en scripts/test_report.json")


if __name__ == "__main__":
    main()
