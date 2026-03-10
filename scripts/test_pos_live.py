import sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE_URL = "https://randazzo.vercel.app"
EMAIL = "luxassilva@gmail.com"
PASSWORD = "admin123"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # Login
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.locator('button[type="submit"]').first.click(force=True)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    ctx.add_cookies(
        [
            {
                "name": "sc_onboarding_done",
                "value": "1",
                "domain": "randazzo.vercel.app",
                "path": "/",
            }
        ]
    )

    # --- POS ---
    page.goto(f"{BASE_URL}/pos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    page.screenshot(path="scripts/pos_01_inicial.png", full_page=True)
    print("Screenshot 1: POS inicial")

    # Ver todos los inputs
    inputs = page.locator("input").all()
    print(f"Inputs en POS: {len(inputs)}")
    for i, inp in enumerate(inputs):
        print(
            f"  [{i}] type={inp.get_attribute('type')} placeholder='{inp.get_attribute('placeholder')}' visible={inp.is_visible()}"
        )

    # Buscar el campo de busqueda
    search = page.locator(
        "input[placeholder*='Buscar'], input[placeholder*='buscar'], input[placeholder*='producto'], input[placeholder*='Producto']"
    ).first
    if search.is_visible():
        print(
            f"Campo de busqueda encontrado: placeholder='{search.get_attribute('placeholder')}'"
        )
        search.fill("col")
        page.wait_for_timeout(2000)
        page.screenshot(path="scripts/pos_02_busqueda_col.png", full_page=True)
        print("Screenshot 2: Busqueda 'col'")

        # Ver resultados
        print(f"Resultados li: {page.locator('li').count()}")
        print(f"Resultados [role=option]: {page.locator('[role=option]').count()}")
        print(f"Resultados [role=listbox]: {page.locator('[role=listbox]').count()}")

        # Limpiar y buscar algo mas generico
        search.fill("")
        page.wait_for_timeout(500)
        search.fill("a")
        page.wait_for_timeout(2000)
        page.screenshot(path="scripts/pos_03_busqueda_a.png", full_page=True)
        print("Screenshot 3: Busqueda 'a'")
        print(f"Resultados con 'a': li={page.locator('li').count()}")

        # Ver el HTML del area de resultados
        results_html = page.locator(
            "[role=listbox], .suggestions, .autocomplete, [class*='result'], [class*='dropdown']"
        ).first
        if results_html.is_visible():
            print(f"Area de resultados: {results_html.inner_text()[:200]}")
    else:
        print("Campo de busqueda NO encontrado")
        # Ver placeholder de todos los inputs
        for i, inp in enumerate(inputs):
            print(f"  Input {i}: placeholder={inp.get_attribute('placeholder')}")

    # --- Consola de errores ---
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on(
        "console",
        lambda msg: (
            errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None
        ),
    )

    search2 = page.locator("input").first
    search2.fill("col")
    page.wait_for_timeout(3000)
    if errors:
        print(f"\nErrores de consola: {errors}")

    browser.close()
    print("\nScreenshots guardados en scripts/")
