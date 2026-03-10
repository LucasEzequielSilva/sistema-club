import sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE_URL = "https://randazzo.vercel.app"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # Agregar cookie
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    print(f"1. URL inicial: {page.url}")
    page.screenshot(path="scripts/debug_1_initial.png", full_page=True)

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

    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    print(f"2. URL en login: {page.url}")
    page.screenshot(path="scripts/debug_2_login.png", full_page=True)

    # Ver todos los inputs
    inputs = page.locator("input").all()
    print(f"3. Inputs encontrados: {len(inputs)}")
    for i, inp in enumerate(inputs):
        print(
            f"   Input {i}: type={inp.get_attribute('type')}, visible={inp.is_visible()}, placeholder={inp.get_attribute('placeholder')}"
        )

    browser.close()
    print("Listo — screenshots guardados")
