"""
QA Test Script - Punto de Venta (POS) Module
Tests the POS module of the Next.js app at http://localhost:3001
"""

import os
import sys
import json
from playwright.sync_api import sync_playwright, ConsoleMessage

# Force UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SCREENSHOTS_DIR = r"D:\Dev\randazzo\scripts\screenshots"
BASE_URL = "http://localhost:3001"
EMAIL = "luxassilva@gmail.com"
PASSWORD = "admin123"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

console_errors = []
console_warnings = []
all_console_messages = []
bugs = []
ux_issues = []


def log(msg):
    safe = str(msg).encode("utf-8", errors="replace").decode("utf-8")
    print(f"[TEST] {safe}")


def bug(description, severity="HIGH"):
    bugs.append({"severity": severity, "description": description})
    print(f"  [BUG-{severity}] {description}")


def ux_issue(description):
    ux_issues.append(description)
    print(f"  [UX] {description}")


def screenshot(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    log(f"Screenshot saved: {name}.png")
    return path


def on_console(msg: ConsoleMessage):
    entry = {"type": msg.type, "text": msg.text[:300], "location": str(msg.location)}
    all_console_messages.append(entry)
    if msg.type == "error":
        console_errors.append(entry)
        print(f"  [JS ERROR] {msg.text[:200]}")
    elif msg.type == "warning":
        console_warnings.append(entry)


def login_and_goto_pos(page):
    """Login, bypass onboarding, and navigate to /pos. Returns True if successful."""
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.locator("#email").fill(EMAIL)
    page.locator("#password").fill(PASSWORD)
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(3000)

    if "/onboarding" in page.url:
        log("Bypassing onboarding...")
        page.evaluate(
            "async () => { await fetch('/api/auth/complete-onboarding', { method: 'POST' }); }"
        )
        page.wait_for_timeout(800)

    page.goto(f"{BASE_URL}/pos", wait_until="networkidle")
    page.wait_for_timeout(1000)
    return "/pos" in page.url


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.on("console", on_console)

        # ── 1. LOGIN & NAVIGATE TO POS ────────────────────────────────────────
        log("Step 1: Login and navigate to POS...")
        success = login_and_goto_pos(page)
        screenshot(page, "01_login_page")

        if not success:
            bug(f"Could not reach /pos page - ended at {page.url}", "CRITICAL")
            browser.close()
            _print_report()
            return

        log(f"On POS page: {page.url}")
        screenshot(page, "02_pos_initial_state")

        # ── 2. INITIAL STATE AUDIT ────────────────────────────────────────────
        log("Step 2: Auditing initial POS state...")

        body_text = page.inner_text("body")
        with open(
            os.path.join(SCREENSHOTS_DIR, "pos_initial_text.txt"), "w", encoding="utf-8"
        ) as f:
            f.write(body_text)

        # --- Stats in header ---
        stats_text = ""
        try:
            # The stats area shows "0 ventas hoy" and "$ 0,00 total"
            stats_containers = page.locator(
                '[class*="stat"], [class*="header"] p, [class*="header"] span, '
                '[class*="badge"], h2, h3, [class*="card"] div'
            ).all()
            visible_stats = [s for s in stats_containers if s.is_visible()]
            stats_text = " | ".join(
                [
                    s.inner_text()[:30].strip()
                    for s in visible_stats[:10]
                    if s.inner_text().strip()
                ]
            )
        except:
            pass

        # Check for specific stat keywords
        ventas_hoy_visible = "ventas hoy" in body_text.lower()
        total_visible = "total" in body_text.lower()
        log(f"'ventas hoy' in page: {ventas_hoy_visible}")
        log(f"'total' in page: {total_visible}")

        if not ventas_hoy_visible:
            bug("POS header: 'ventas hoy' counter not visible", "MEDIUM")
        if not total_visible:
            bug("POS header: 'total' amount stat not visible", "MEDIUM")

        # Extract initial numeric values for stats comparison
        import re

        ventas_match = re.search(r"(\d+)\s*ventas hoy", body_text, re.IGNORECASE)
        total_match = re.search(r"\$\s*([\d,\.]+)\s*total", body_text, re.IGNORECASE)
        initial_ventas = ventas_match.group(1) if ventas_match else "unknown"
        initial_total = total_match.group(1) if total_match else "unknown"
        log(f"Initial stats: ventas hoy={initial_ventas}, total={initial_total}")

        # --- Search input ---
        search_input = page.locator('input[placeholder="Nombre o código de barras..."]')
        search_visible = search_input.is_visible()
        log(f"Search input visible: {search_visible}")
        if not search_visible:
            bug(
                "POS: Product search input ('Nombre o código de barras...') not visible",
                "CRITICAL",
            )
        else:
            log("Search input: FOUND - placeholder='Nombre o código de barras...'")

        # --- Lista de precios selector ---
        price_list = page.locator(
            'button:has-text("Minorista"), [class*="price-list"]'
        ).first
        if price_list.count() > 0 and price_list.is_visible():
            log(f"Price list selector visible: {price_list.inner_text()[:40]}")
        else:
            ux_issue(
                "No price list selector visible - cannot switch between price lists"
            )

        # --- Confirm Sale button (initial state) ---
        confirm_btn = page.locator('button:has-text("Confirmar Venta")')
        if confirm_btn.count() == 0:
            bug("POS: 'Confirmar Venta' button not found on page", "HIGH")
        else:
            initial_confirm_enabled = confirm_btn.first.is_enabled()
            log(
                f"'Confirmar Venta' button - initial enabled: {initial_confirm_enabled}"
            )
            if initial_confirm_enabled:
                ux_issue(
                    "BUG: 'Confirmar Venta' button is ENABLED with empty cart - "
                    "should be disabled until products are added"
                )
            else:
                log("Confirmar Venta correctly DISABLED with empty cart")

        # --- Cart empty state ---
        cart_empty_msg = page.locator(
            'text="Seleccioná un producto para comenzar"'
        ).first
        if cart_empty_msg.count() > 0 and cart_empty_msg.is_visible():
            log("Cart empty state message: visible (correct)")
        else:
            ux_issue(
                "No empty cart placeholder message - user may be confused about where to start"
            )

        # --- RESUMEN section ---
        resumen_visible = "RESUMEN" in body_text
        log(f"RESUMEN section visible: {resumen_visible}")

        # ── 3. SEARCH PRODUCT ─────────────────────────────────────────────────
        log("Step 3: Searching for 'col'...")
        screenshot(page, "03_before_search")

        if not search_visible:
            log("Skipping search - input not found")
        else:
            search_input.click()
            search_input.fill("col")
            page.wait_for_timeout(1200)
            screenshot(page, "04_search_results_col")

            # Verify dropdown appeared
            dropdown = page.locator("div.absolute.z-50")
            dropdown_visible = dropdown.count() > 0 and dropdown.first.is_visible()
            log(f"Search dropdown visible: {dropdown_visible}")

            if not dropdown_visible:
                bug("Search for 'col': no dropdown/results appeared", "HIGH")
            else:
                result_btns = page.locator("div.absolute.z-50 button").all()
                log(f"Products in dropdown: {len(result_btns)}")

                for i, btn in enumerate(result_btns[:5]):
                    log(f"  Result {i + 1}: {btn.inner_text()[:60].strip()}")

                if len(result_btns) == 0:
                    bug(
                        "Search dropdown appeared but contains no product buttons",
                        "HIGH",
                    )
                    ux_issue("Search for 'col' returned empty dropdown")
                else:
                    log(f"Search results working: {len(result_btns)} product(s) found")

                # ── 4. ADD PRODUCT TO CART ────────────────────────────────────
                log("Step 4: Adding product to cart...")
                first_result = result_btns[0]
                product_name = first_result.inner_text()[:40].strip().split("\n")[0]
                log(f"Adding: {product_name}")

                first_result.click()
                page.wait_for_timeout(1000)
                screenshot(page, "05_product_selected")

                # Verify product detail panel appeared
                body_after_add = page.inner_text("body")

                # Check if product name appears in cart/detail area
                if product_name.split("\n")[0][:10] in body_after_add:
                    log(
                        f"Product '{product_name[:20]}' appears in page after selection"
                    )
                else:
                    bug(f"Product not visible in page after clicking result", "HIGH")

                # Check cart/detail content
                cantidad_visible = "CANTIDAD" in body_after_add
                descuento_visible = "DESCUENTO" in body_after_add
                medio_pago_visible = (
                    "MEDIO DE PAGO" in body_after_add or "Efectivo" in body_after_add
                )
                resumen_after = "RESUMEN" in body_after_add
                rentabilidad = "RENTABILIDAD" in body_after_add

                log(f"CANTIDAD visible: {cantidad_visible}")
                log(f"DESCUENTO visible: {descuento_visible}")
                log(f"MEDIO DE PAGO visible: {medio_pago_visible}")
                log(f"RESUMEN visible: {resumen_after}")
                log(f"RENTABILIDAD visible: {rentabilidad}")

                if not cantidad_visible:
                    bug("After adding product, CANTIDAD controls not visible", "HIGH")
                if not medio_pago_visible:
                    ux_issue("No MEDIO DE PAGO section visible after adding product")

                # Check quantity +/- buttons
                qty_minus = page.locator('button:has-text("-")').all()
                qty_plus = page.locator('button:has-text("+")').all()
                log(f"Quantity buttons: minus={len(qty_minus)}, plus={len(qty_plus)}")

                if len(qty_plus) == 0 or len(qty_minus) == 0:
                    bug("Quantity +/- buttons missing in product detail", "HIGH")
                else:
                    log("Quantity controls: + and - buttons present")

                # ── 5. QUANTITY CONTROL TEST ──────────────────────────────────
                log("Step 5: Testing quantity controls...")
                screenshot(page, "06_product_detail_panel")

                if len(qty_plus) > 0:
                    qty_plus[0].click()
                    page.wait_for_timeout(500)
                    screenshot(page, "07_qty_incremented")

                    body_qty = page.inner_text("body")
                    # Expect "Cantidad 2" in resumen
                    if (
                        "Cantidad\n2" in body_qty
                        or "Cantidad2" in body_qty
                        or "Cantidad\n\n2" in body_qty
                    ):
                        log("Quantity incremented to 2 (correct)")
                    else:
                        # Check for total doubling
                        price_match = re.search(
                            r"Total\s*\n?\s*\$\s*([\d,\.]+)", body_qty
                        )
                        if price_match:
                            log(f"Total after qty+1: $ {price_match.group(1)}")
                        else:
                            ux_issue(
                                "Quantity increment: could not verify total updated in RESUMEN"
                            )

                    # Test minus button
                    if len(qty_minus) > 0:
                        qty_minus[0].click()
                        page.wait_for_timeout(500)
                        log("Quantity decremented back")

                # ── 6. DISCOUNT TEST ──────────────────────────────────────────
                log("Step 6: Testing discount field...")
                if descuento_visible:
                    descuento_input = page.locator(
                        'input[placeholder*="descuento" i], '
                        '[class*="descuento"] input, '
                        'label:has-text("DESCUENTO") ~ * input'
                    ).first
                    if descuento_input.count() > 0 and descuento_input.is_visible():
                        descuento_input.fill("10")
                        page.wait_for_timeout(500)
                        screenshot(page, "08_discount_applied")
                        log("Discount input filled with 10%")

                        body_disc = page.inner_text("body")
                        # Look for price changes indicating discount applied
                        log("Discount field interaction: tested")
                    else:
                        ux_issue("DESCUENTO label shown but no input field found")
                else:
                    ux_issue("No DESCUENTO field visible in product detail")

                # ── 7. CONFIRM BUTTON STATE AFTER ADDING ─────────────────────
                log("Step 7: Checking 'Confirmar Venta' after adding product...")
                confirm_after = page.locator('button:has-text("Confirmar Venta")')
                if confirm_after.count() > 0:
                    enabled_after = confirm_after.first.is_enabled()
                    log(
                        f"'Confirmar Venta' enabled after adding product: {enabled_after}"
                    )
                    if not enabled_after:
                        bug(
                            "'Confirmar Venta' button DISABLED even after adding a product to cart",
                            "CRITICAL",
                        )
                    else:
                        log("'Confirmar Venta' correctly ENABLED after adding product")

                    # Check button shows price
                    btn_text = confirm_after.first.inner_text()
                    log(f"Confirm button text: '{btn_text[:60]}'")
                    if "$" in btn_text:
                        log("Confirm button shows total price (good UX)")
                    else:
                        ux_issue(
                            "'Confirmar Venta' button does not show the sale total amount"
                        )

                screenshot(page, "09_confirm_button_state")

                # ── 8. COMPLETE SALE ──────────────────────────────────────────
                log("Step 8: Completing the sale...")
                if confirm_after.count() > 0 and confirm_after.first.is_enabled():
                    confirm_after.first.click()
                    page.wait_for_timeout(2000)
                    screenshot(page, "10_after_confirm_click")
                    log(f"URL after confirm: {page.url}")

                    body_after_confirm = page.inner_text("body")

                    # Check for success modal/feedback
                    modals = page.locator('[role="dialog"], [class*="modal"]').all()
                    visible_modals = [m for m in modals if m.is_visible()]

                    success_kws = [
                        "completada",
                        "exitosa",
                        "success",
                        "confirmada",
                        "ticket",
                        "comprobante",
                    ]
                    success_found = [
                        kw
                        for kw in success_kws
                        if kw.lower() in body_after_confirm.lower()
                    ]

                    log(f"Success keywords: {success_found}")
                    log(f"Visible modals/dialogs: {len(visible_modals)}")

                    if visible_modals:
                        modal_text = visible_modals[0].inner_text()[:200]
                        log(f"Modal content: {modal_text}")

                    if not success_found and not visible_modals:
                        bug(
                            "After confirming sale, no success feedback (modal/message) visible",
                            "HIGH",
                        )
                    else:
                        log("Sale confirmation feedback detected")

                    screenshot(page, "11_sale_result")

                    # ── 9. STATS UPDATE CHECK ─────────────────────────────────
                    log("Step 9: Verifying stats update after sale...")
                    page.wait_for_timeout(1500)

                    # Navigate back to POS for fresh stats
                    page.goto(f"{BASE_URL}/pos", wait_until="networkidle")
                    page.wait_for_timeout(1000)
                    screenshot(page, "12_pos_after_sale_stats")

                    body_after_sale = page.inner_text("body")
                    ventas_match_after = re.search(
                        r"(\d+)\s*ventas hoy", body_after_sale, re.IGNORECASE
                    )
                    total_match_after = re.search(
                        r"\$\s*([\d,\.]+)\s*total", body_after_sale, re.IGNORECASE
                    )
                    final_ventas = (
                        ventas_match_after.group(1) if ventas_match_after else "unknown"
                    )
                    final_total = (
                        total_match_after.group(1) if total_match_after else "unknown"
                    )
                    log(
                        f"Stats after sale: ventas hoy={final_ventas}, total={final_total}"
                    )

                    if initial_ventas != "unknown" and final_ventas != "unknown":
                        if int(final_ventas) > int(initial_ventas):
                            log(
                                f"'ventas hoy' counter UPDATED: {initial_ventas} -> {final_ventas} (correct)"
                            )
                        else:
                            bug(
                                f"'ventas hoy' counter NOT updated after sale: "
                                f"was {initial_ventas}, still {final_ventas}",
                                "HIGH",
                            )

                    if initial_total != "unknown" and final_total != "unknown":
                        if initial_total != final_total:
                            log(
                                f"'total' amount UPDATED: {initial_total} -> {final_total} (correct)"
                            )
                        else:
                            bug(
                                f"'total' amount NOT updated after sale: "
                                f"was {initial_total}, still {final_total}",
                                "HIGH",
                            )
                else:
                    log("Cannot complete sale - Confirmar Venta not enabled")
                    ux_issue("Could not complete full checkout flow")

        # ── 10. KEYBOARD SHORTCUT VERIFICATION ───────────────────────────────
        log("Step 10: Keyboard shortcut verification...")
        page.goto(f"{BASE_URL}/pos", wait_until="networkidle")
        page.wait_for_timeout(800)

        shortcut_hint = page.locator('text="Ctrl"').first
        kbd_elements = page.locator('kbd, [class*="kbd"], [class*="shortcut"]').all()
        log(f"Keyboard hint elements: {len(kbd_elements)}")

        body_shortcuts = page.inner_text("body")
        if "ctrl" in body_shortcuts.lower() or "ctrl" in body_shortcuts.lower():
            log("Keyboard shortcut hint visible (Ctrl+Enter to confirm)")
        else:
            ux_issue("No keyboard shortcut hints visible in POS")

        # ── 11. EDGE CASES ────────────────────────────────────────────────────
        log("Step 11: Testing edge cases...")

        # Test: empty search
        search_final = page.locator('input[placeholder="Nombre o código de barras..."]')
        if search_final.is_visible():
            search_final.click()
            search_final.fill("")
            page.wait_for_timeout(500)
            # No dropdown should appear
            dropdown_empty = page.locator("div.absolute.z-50").count()
            log(f"Dropdown on empty search: {dropdown_empty} elements")

            # Test: search with no results
            search_final.fill("xyzxyzxyz123abc")
            page.wait_for_timeout(1200)
            screenshot(page, "13_search_no_results")
            body_no_results = page.inner_text("body")
            no_result_kws = ["no se encontr", "sin resultados", "no hay", "no results"]
            has_no_result_msg = any(
                kw in body_no_results.lower() for kw in no_result_kws
            )
            log(f"'No results' message for unknown product: {has_no_result_msg}")
            if not has_no_result_msg:
                # Check if dropdown simply hides or shows empty
                empty_dropdown = page.locator("div.absolute.z-50").count()
                if empty_dropdown == 0:
                    log("No results: dropdown hides (acceptable UX)")
                else:
                    ux_issue(
                        "Search with no results: unclear feedback (no 'no results' message)"
                    )

        # ── 12. VISUAL / LAYOUT CHECK ─────────────────────────────────────────
        log("Step 12: Visual and layout checks...")
        page.goto(f"{BASE_URL}/pos", wait_until="networkidle")
        page.wait_for_timeout(800)
        screenshot(page, "14_pos_final_overview")

        # Check page title
        title = page.title()
        log(f"Page title: {title}")

        # Check for any visible error/alert elements
        error_els = page.locator(
            '[role="alert"], .text-destructive, [class*="error-message"]'
        ).all()
        for el in error_els:
            try:
                if el.is_visible():
                    txt = el.inner_text()[:100].strip()
                    if txt:
                        bug(f"Visible error/alert on page: '{txt}'", "MEDIUM")
            except:
                pass

        # Check responsive layout (mobile viewport)
        log("Step 13: Mobile viewport check...")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(500)
        screenshot(page, "15_pos_mobile_view")

        body_mobile = page.inner_text("body")
        search_mobile = page.locator(
            'input[placeholder="Nombre o código de barras..."]'
        )
        if not search_mobile.is_visible():
            ux_issue(
                "Search input NOT visible on mobile viewport (390px) - mobile layout issue"
            )
        else:
            log("Search input visible on mobile viewport")

        # Reset to desktop
        page.set_viewport_size({"width": 1280, "height": 900})

        browser.close()
        log("Browser closed.")

    _print_report()


def _print_report():
    print("\n" + "=" * 70)
    print("           QA REPORT - MODULO PUNTO DE VENTA (POS)")
    print("=" * 70)

    print(f"\n{'─' * 70}")
    print(f"BUGS ENCONTRADOS ({len(bugs)}):")
    print(f"{'─' * 70}")
    if bugs:
        for i, b in enumerate(bugs, 1):
            print(f"  {i}. [{b['severity']}] {b['description']}")
    else:
        print("  Ninguno detectado")

    print(f"\n{'─' * 70}")
    print(f"UX ISSUES ({len(ux_issues)}):")
    print(f"{'─' * 70}")
    if ux_issues:
        for i, u in enumerate(ux_issues, 1):
            print(f"  {i}. {u}")
    else:
        print("  Ninguno detectado")

    print(f"\n{'─' * 70}")
    print(f"ERRORES DE CONSOLA JS ({len(console_errors)}):")
    print(f"{'─' * 70}")
    if console_errors:
        for i, e in enumerate(console_errors, 1):
            print(f"  {i}. {e['text'][:250]}")
    else:
        print("  Ninguno detectado")

    print(f"\n{'─' * 70}")
    print(f"WARNINGS DE CONSOLA JS ({len(console_warnings)}):")
    print(f"{'─' * 70}")
    if console_warnings:
        for i, w in enumerate(console_warnings[:10], 1):
            print(f"  {i}. {w['text'][:200]}")
        if len(console_warnings) > 10:
            print(f"  ... y {len(console_warnings) - 10} warnings mas")
    else:
        print("  Ninguno detectado")

    print(f"\n{'─' * 70}")
    print("SCREENSHOTS TOMADOS:")
    print(f"{'─' * 70}")
    screenshots_taken = sorted(
        [
            f
            for f in os.listdir(SCREENSHOTS_DIR)
            if f.endswith(".png") and not f.startswith("debug")
        ]
    )
    for s in screenshots_taken:
        print(f"  - scripts/screenshots/{s}")

    report = {
        "bugs": bugs,
        "ux_issues": ux_issues,
        "console_errors": console_errors,
        "console_warnings": console_warnings[:20],
        "total_console_messages": len(all_console_messages),
        "screenshots": screenshots_taken,
    }
    report_path = os.path.join(SCREENSHOTS_DIR, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n  Full JSON report: {report_path}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_tests()
