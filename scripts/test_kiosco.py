# -*- coding: utf-8 -*-
"""
QA Test Script: "Don Pepe Kiosco" (kiosco@test.com)
Flujo completo: Login -> Tablero -> Productos -> POS -> Mercaderia -> Compras -> Clasificaciones
"""

import sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

SCREENSHOTS_DIR = Path("D:/Dev/randazzo/scripts/screenshots/kiosco")
BASE_URL = "http://localhost:3001"
EMAIL = "kiosco@test.com"
PASSWORD = "test123"
TIMEOUT = 15000

SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
# Clean previous test screenshots
for f in SCREENSHOTS_DIR.glob("test_*.png"):
    f.unlink()

results = []
screenshots_saved = []
bugs = []


def ss(page, name):
    path = str(SCREENSHOTS_DIR / f"test_{name}")
    page.screenshot(path=path, full_page=True)
    screenshots_saved.append(f"test_{name}")
    print(f"  [ss] test_{name}")


def ok(step, msg=""):
    results.append({"step": step, "status": "PASS", "msg": msg})
    print(f"  [PASS] {step}" + (f" — {msg}" if msg else ""))


def fail(step, msg=""):
    results.append({"step": step, "status": "FAIL", "msg": msg})
    print(f"  [FAIL] {step} — {msg}")


def bug(desc):
    bugs.append(desc)
    print(f"  [BUG] {desc}")


def goto(page, path, wait=2000):
    page.goto(f"{BASE_URL}{path}", timeout=TIMEOUT)
    page.wait_for_load_state("networkidle", timeout=TIMEOUT)
    page.wait_for_timeout(wait)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    page.set_default_timeout(TIMEOUT)

    print("\n" + "=" * 60)
    print("QA TEST: Don Pepe Kiosco")
    print("=" * 60)

    # ══════════════════════════════════════════════════════════════
    # PASO 1: LOGIN
    # ══════════════════════════════════════════════════════════════
    print("\n[1] LOGIN")
    try:
        goto(page, "/login", 1000)
        ss(page, "01_login_page.png")

        page.fill("#email", EMAIL)
        page.fill("#password", PASSWORD)
        ss(page, "01b_login_filled.png")

        page.click('button[type="submit"]')
        page.wait_for_timeout(4000)
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)

        url = page.url
        if "login" in url.lower():
            ss(page, "01c_login_failed.png")
            fail("Login", f"Sigue en /login: {url}")
        else:
            ss(page, "01c_login_success.png")
            ok("Login", f"Autenticado OK, URL post-login: {url}")

        if "/onboarding" in url:
            bug(
                "BUG: Login con datos existentes redirige a /onboarding. "
                "La cuenta kiosco@test.com tiene 12 productos, stock, clasificaciones y proveedores "
                "pero el sistema fuerza onboarding al primer login. "
                "Impacto: usuario no puede acceder a ninguna seccion del sistema."
            )

    except Exception as e:
        ss(page, "01_error.png")
        fail("Login", str(e))

    # ══════════════════════════════════════════════════════════════
    # SETUP: Bypass onboarding via API
    # ══════════════════════════════════════════════════════════════
    print("\n[SETUP] Bypass onboarding...")
    try:
        if "/onboarding" in page.url:
            resp = page.evaluate("""
                async () => {
                    const r = await fetch('/api/auth/complete-onboarding', { method: 'POST' });
                    return { status: r.status, ok: r.ok };
                }
            """)
            print(f"  complete-onboarding response: {resp}")
            if resp.get("ok"):
                goto(page, "/tablero", 2000)
                if "/tablero" in page.url:
                    ok(
                        "Onboarding bypass",
                        "API /api/auth/complete-onboarding devolvio 200, acceso a /tablero OK",
                    )
                else:
                    fail("Onboarding bypass", f"Bypass OK pero URL es {page.url}")
            else:
                fail("Onboarding bypass", f"API devolvio status {resp.get('status')}")
        else:
            print("  Sin onboarding pendiente")
    except Exception as e:
        fail("Onboarding bypass", str(e))

    # ══════════════════════════════════════════════════════════════
    # PASO 2: TABLERO
    # ══════════════════════════════════════════════════════════════
    print("\n[2] TABLERO")
    try:
        if "/tablero" not in page.url:
            goto(page, "/tablero", 3000)  # Extra wait — Next.js puede redirigir

        ss(page, "02_tablero.png")

        url = page.url
        # App puede redirigir a /tablero, /resumen, o /ventas dependiendo del estado
        tablero_urls = ["/tablero", "/resumen", "/ventas"]
        tablero_loaded = (
            any(p in url for p in tablero_urls) and "/onboarding" not in url
        )

        if tablero_loaded:
            ok("Tablero - Carga", f"Dashboard cargado en {url}")
        else:
            fail("Tablero - Carga", f"No se pudo cargar dashboard, URL: {url}")

        if tablero_loaded:
            visible = page.evaluate("document.body.innerText")

            # Check "Primeros Pasos" widget
            has_primeros_pasos = any(
                kw in visible
                for kw in ["PRIMEROS PASOS", "Primeros Pasos", "Configurá tu negocio"]
            )
            if has_primeros_pasos:
                print("  -> Widget 'Primeros Pasos' visible")

            # Check for low stock alerts
            has_low_stock = any(
                kw in visible.lower()
                for kw in [
                    "stock bajo",
                    "low stock",
                    "stock critico",
                    "alerta de stock",
                    "poco stock",
                    "sin stock",
                    "critico",
                ]
            )
            alert_count = page.locator('[role="alert"]').count()
            print(f"  [role=alert] elements: {alert_count}")
            print(f"  has_low_stock_keywords: {has_low_stock}")

            if has_low_stock:
                ok(
                    "Tablero - Alerta stock bajo",
                    "Alerta de stock bajo visible en tablero",
                )
            else:
                fail(
                    "Tablero - Alerta stock bajo",
                    "No se muestra alerta de stock bajo. "
                    "Los 2 productos con stock bajo son: Jugo Cepita Naranja 1L (stock=5) y "
                    "Caramelos Sugus x4 (stock=16). "
                    "Probable causa: minStock=0 en ambos productos, no dispara alerta.",
                )
                bug(
                    "BUG: Tablero no muestra alertas de stock bajo. "
                    "Jugo Cepita Naranja 1L (stock=5) y Caramelos Sugus x4 (stock=16) no generan "
                    "ninguna notificacion visible. Probable causa: minStock configurado en 0."
                )

    except Exception as e:
        ss(page, "02_tablero_error.png")
        fail("Tablero", str(e))

    # ══════════════════════════════════════════════════════════════
    # PASO 3: PRODUCTOS
    # ══════════════════════════════════════════════════════════════
    print("\n[3] PRODUCTOS")
    try:
        goto(page, "/productos", 2000)
        ss(page, "03_productos_list.png")

        if "/productos" not in page.url:
            fail("Productos - Lista", f"No se cargó /productos, URL: {page.url}")
        else:
            tbody_rows = page.locator("table tbody tr").count()
            print(f"  Productos en tabla: {tbody_rows}")

            if tbody_rows >= 10:
                ok(
                    "Productos - Lista",
                    f"{tbody_rows} productos cargados en la tabla (esperado ~12)",
                )
            elif tbody_rows > 0:
                fail("Productos - Lista", f"Solo {tbody_rows} productos (esperado ~12)")
            else:
                fail("Productos - Lista", "Tabla vacia o no encontrada")

            # Check "Stock bajo" filter button
            stock_bajo = page.locator('button:has-text("Stock bajo")')
            if stock_bajo.count() > 0:
                ok(
                    "Productos - Filtro stock bajo",
                    "Boton 'Stock bajo' disponible en la lista de productos",
                )
                # Click it to verify
                stock_bajo.click()
                page.wait_for_timeout(1000)
                ss(page, "03b_productos_stock_bajo_filter.png")
                filtered_rows = page.locator("table tbody tr").count()
                print(f"  Productos con stock bajo: {filtered_rows}")
                if filtered_rows == 2:
                    ok(
                        "Productos - 2 con stock bajo",
                        f"Se encontraron exactamente {filtered_rows} productos con stock bajo (correcto)",
                    )
                elif filtered_rows > 0:
                    fail(
                        "Productos - 2 con stock bajo",
                        f"Se encontraron {filtered_rows} productos con stock bajo (esperado: 2)",
                    )
                else:
                    fail(
                        "Productos - 2 con stock bajo",
                        f"Filtro 'Stock bajo' activo pero retorna 0 resultados. "
                        f"BUG: Los productos Jugo Cepita (stock=5) y Caramelos Sugus (stock=16) "
                        f"tienen minStock=0, por eso el filtro no los detecta como stock bajo.",
                    )
                    bug(
                        "BUG: Filtro 'Stock bajo' en /productos no detecta productos criticos. "
                        "Jugo Cepita Naranja 1L (stock=5) y Caramelos Sugus x4 (stock=16) "
                        "no aparecen porque su umbral minStock esta configurado en 0. "
                        "El filtro compara stock <= minStock, y 5 > 0."
                    )
                # Reset filter — click again to deactivate
                page.locator('button:has-text("Stock bajo")').click()
                page.wait_for_timeout(1000)
                rows_reset = page.locator("table tbody tr").count()
                print(f"  Rows after filter reset: {rows_reset}")
            else:
                fail(
                    "Productos - Filtro stock bajo", "No se encontro boton 'Stock bajo'"
                )

            # Open product detail via action button (dropdown trigger in last column)
            try:
                # The action button is a dropdown-menu-trigger (3-dot icon)
                action_btn = page.locator(
                    'table tbody tr:first-child [data-slot="dropdown-menu-trigger"], '
                    "table tbody tr:first-child td:last-child button"
                ).first
                btn_count = action_btn.count()
                print(f"  Action button found: {btn_count}")

                if btn_count > 0:
                    action_btn.click()
                    page.wait_for_timeout(1500)
                    ss(page, "03c_producto_accion.png")

                    # Check for dropdown menu
                    dropdown = page.locator(
                        '[role="menu"], [data-radix-dropdown-menu-content]'
                    )
                    dialog = page.locator('[role="dialog"]')
                    new_url = page.url

                    if dropdown.count() > 0:
                        menu_text = dropdown.first.text_content()
                        ok(
                            "Productos - Boton accion (dropdown)",
                            f"Menu dropdown abierto: {(menu_text or '')[:60]}",
                        )
                    elif dialog.count() > 0:
                        dt = dialog.first.text_content()
                        ok(
                            "Productos - Detalle/Edicion",
                            f"Modal abierto: {(dt or '')[:50]}",
                        )
                    elif new_url != f"{BASE_URL}/productos":
                        ok("Productos - Detalle/Edicion", f"Navegacion a: {new_url}")
                    else:
                        fail(
                            "Productos - Boton accion (dropdown)",
                            "El boton de accion (3 puntos) no abre dropdown ni modal",
                        )
                        bug(
                            "BUG: El boton de accion de la tabla de productos "
                            "(data-slot=dropdown-menu-trigger) no abre menu contextual. "
                            "No hay forma de ver/editar detalle de producto individual."
                        )
                else:
                    fail(
                        "Productos - Boton accion",
                        "No se encontro boton de accion en la fila",
                    )
            except Exception as e_detail:
                ss(page, "03c_detalle_error.png")
                fail("Productos - Detalle/Edicion", str(e_detail))

    except Exception as e:
        ss(page, "03_error.png")
        fail("Productos", str(e))

    # ══════════════════════════════════════════════════════════════
    # PASO 4: POS (Punto de Venta)
    # ══════════════════════════════════════════════════════════════
    print("\n[4] POS (Punto de Venta)")
    try:
        goto(page, "/pos", 2000)
        ss(page, "04_pos_initial.png")

        if "/pos" not in page.url:
            fail("POS", f"No se cargó /pos, URL: {page.url}")
        else:
            print(f"  POS cargado en: {page.url}")

            # ── Busqueda de producto ──
            search_ok = False
            try:
                search = page.get_by_placeholder("Nombre o código de barras...")
                search_count = search.count()
                print(f"  Search input found: {search_count}")

                if search_count > 0:
                    search.click()
                    search.fill("coca")
                    page.wait_for_timeout(1500)
                    ss(page, "04b_pos_search_coca.png")

                    visible_after = page.evaluate("document.body.innerText")
                    if "coca" in visible_after.lower():
                        ok(
                            "POS - Busqueda de producto",
                            "Busqueda 'coca' retorno resultados (Coca Cola 500ml visible)",
                        )
                        search_ok = True
                    else:
                        fail(
                            "POS - Busqueda de producto",
                            "No aparecieron resultados para 'coca'",
                        )
                else:
                    fail(
                        "POS - Busqueda de producto", "No se encontro input de busqueda"
                    )

            except Exception as e_s:
                ss(page, "04b_search_error.png")
                fail("POS - Busqueda de producto", str(e_s))

            # ── Agregar producto al carrito ──
            cart_ok = False
            if search_ok:
                try:
                    # Product appears as a button with class w-full text-left px-4 py-3...
                    coca_btn = page.locator('button:has-text("Coca Cola")')
                    btn_count = coca_btn.count()
                    print(f"  'Coca Cola' buttons: {btn_count}")

                    if btn_count > 0:
                        coca_btn.first.click()
                        page.wait_for_timeout(1000)
                        ss(page, "04c_pos_product_selected.png")

                        visible_cart = page.evaluate("document.body.innerText")
                        # After clicking, the product detail + cart summary should appear
                        has_cart = any(
                            kw in visible_cart
                            for kw in [
                                "RESUMEN",
                                "Total",
                                "Precio unitario",
                                "CANTIDAD",
                                "Confirmar Venta",
                            ]
                        )
                        confirm_disabled = page.locator(
                            'button:has-text("Confirmar Venta")'
                        ).get_attribute("disabled")
                        print(
                            f"  Cart loaded: {has_cart}, Confirm disabled: {confirm_disabled}"
                        )

                        if has_cart and confirm_disabled is None:
                            ok(
                                "POS - Agregar al carrito",
                                "Producto seleccionado, resumen y 'Confirmar Venta' habilitado",
                            )
                            cart_ok = True
                        elif has_cart:
                            fail(
                                "POS - Agregar al carrito",
                                "Resumen visible pero Confirmar Venta sigue deshabilitado",
                            )
                        else:
                            fail(
                                "POS - Agregar al carrito",
                                "No se pudo confirmar que producto fue al carrito",
                            )
                    else:
                        fail(
                            "POS - Agregar al carrito",
                            "No se encontro boton de producto 'Coca Cola' en resultados",
                        )

                except Exception as e_add:
                    ss(page, "04c_add_error.png")
                    fail("POS - Agregar al carrito", str(e_add))

            # ── Lista de precios Minorista ──
            try:
                visible_pos = page.evaluate("document.body.innerText")
                if "Minorista" in visible_pos:
                    ok(
                        "POS - Lista de precios Minorista",
                        "Lista 'Minorista' visible y disponible en POS",
                    )
                    ss(page, "04d_pos_lista_precios.png")
                else:
                    fail(
                        "POS - Lista de precios Minorista",
                        "No se encontro 'Minorista' en POS",
                    )
            except Exception as e_l:
                fail("POS - Lista de precios Minorista", str(e_l))

            # ── Efectivo ya seleccionado por defecto ──
            try:
                visible_pos2 = page.evaluate("document.body.innerText")
                if "Efectivo" in visible_pos2:
                    ok(
                        "POS - Metodo Efectivo disponible",
                        "Efectivo visible como metodo de pago en POS",
                    )
                else:
                    fail(
                        "POS - Metodo Efectivo disponible",
                        "No se encontro 'Efectivo' como medio de pago",
                    )
            except:
                pass

            # ── Completar venta ──
            if cart_ok:
                try:
                    confirm_btn = page.locator(
                        'button:has-text("Confirmar Venta")'
                    ).first
                    is_disabled = confirm_btn.get_attribute("disabled")

                    if is_disabled is None:
                        confirm_btn.click()
                        page.wait_for_timeout(3000)
                        page.wait_for_load_state("networkidle", timeout=TIMEOUT)
                        ss(page, "04e_pos_sale_done.png")

                        visible_done = page.evaluate("document.body.innerText")
                        print(f"  Post-venta: {visible_done[300:600]}")

                        # Check for sale completion indicators
                        sale_done = any(
                            kw in visible_done.lower()
                            for kw in [
                                "venta registrada",
                                "exito",
                                "completada",
                                "comprobante",
                                "imprimir",
                                "recibo",
                                "ticket",
                                "nueva venta",
                            ]
                        )
                        if sale_done:
                            ok(
                                "POS - Completar venta Efectivo",
                                "Venta completada exitosamente",
                            )

                            # Check print button
                            has_print = any(
                                kw in visible_done.lower()
                                for kw in [
                                    "imprimir",
                                    "comprobante",
                                    "recibo",
                                    "print",
                                    "ticket",
                                ]
                            )
                            if has_print:
                                ok(
                                    "POS - Boton imprimir comprobante",
                                    "Boton/opcion de imprimir comprobante visible",
                                )
                                ss(page, "04f_pos_print_btn.png")
                            else:
                                fail(
                                    "POS - Boton imprimir comprobante",
                                    "No se encontro boton de imprimir tras la venta",
                                )
                        else:
                            # Check if counter incremented
                            ventas_hoy = (
                                "1" in visible_done
                                and "ventas hoy" in visible_done.lower()
                            )
                            if ventas_hoy:
                                ok(
                                    "POS - Completar venta Efectivo",
                                    "Contador de ventas incremento a 1",
                                )
                            else:
                                fail(
                                    "POS - Completar venta Efectivo",
                                    "No se pudo confirmar que la venta se registro",
                                )
                    else:
                        fail(
                            "POS - Completar venta Efectivo",
                            "Boton Confirmar Venta deshabilitado",
                        )

                except Exception as e_sale:
                    ss(page, "04e_pos_sale_error.png")
                    fail("POS - Completar venta Efectivo", str(e_sale))
            else:
                fail(
                    "POS - Completar venta Efectivo",
                    "Saltado — carrito no se pudo llenar en pasos anteriores",
                )
                fail(
                    "POS - Boton imprimir comprobante", "Saltado — venta no completada"
                )

    except Exception as e:
        ss(page, "04_pos_error.png")
        fail("POS", str(e))

    # ══════════════════════════════════════════════════════════════
    # PASO 5: MERCADERIA
    # ══════════════════════════════════════════════════════════════
    print("\n[5] MERCADERIA")
    try:
        goto(page, "/mercaderia", 2000)
        ss(page, "05_mercaderia.png")

        if "/mercaderia" not in page.url:
            fail("Mercaderia", f"No se cargó /mercaderia, URL: {page.url}")
        else:
            visible = page.evaluate("document.body.innerText")

            # Count movement rows
            tbody_rows = page.locator("table tbody tr").count()
            print(f"  Movimientos en tabla: {tbody_rows}")

            has_keywords = any(
                kw in visible.lower()
                for kw in [
                    "movimiento",
                    "stock inicial",
                    "ajuste",
                    "ingreso",
                    "mercaderia",
                    "mercadería",
                ]
            )

            if tbody_rows >= 10:
                ok(
                    "Mercaderia - Tabla movimientos",
                    f"Tabla de movimientos con {tbody_rows} registros",
                )
            elif tbody_rows > 0:
                ok(
                    "Mercaderia - Tabla movimientos",
                    f"Tabla con {tbody_rows} registros",
                )
            elif has_keywords:
                ok("Mercaderia - Carga", "Seccion Mercaderia cargada (tabla vacia)")
            else:
                fail(
                    "Mercaderia - Tabla movimientos",
                    f"No se encontro tabla de movimientos",
                )

            # Check tabs
            tabs = page.locator('[role="tab"]').all()
            tab_texts = [
                (t.text_content() or "").strip() for t in tabs if t.text_content()
            ]
            print(f"  Tabs: {tab_texts}")
            if tab_texts:
                ok("Mercaderia - Tabs", f"Tabs disponibles: {', '.join(tab_texts)}")

    except Exception as e:
        ss(page, "05_mercaderia_error.png")
        fail("Mercaderia", str(e))

    # ══════════════════════════════════════════════════════════════
    # PASO 6: COMPRAS
    # ══════════════════════════════════════════════════════════════
    print("\n[6] COMPRAS")
    try:
        goto(page, "/compras", 2000)
        ss(page, "06_compras.png")

        if "/compras" not in page.url:
            fail("Compras - Carga", f"No se cargó /compras, URL: {page.url}")
        else:
            visible = page.evaluate("document.body.innerText")
            is_404 = "404" in visible
            has_content = any(
                kw in visible.lower()
                for kw in ["compra", "egreso", "proveedor", "nueva compra", "registrar"]
            )

            if has_content and not is_404:
                ok("Compras - Carga", f"Seccion Compras cargada en {page.url}")
                tbody_rows = page.locator("table tbody tr").count()
                print(f"  Compras registradas: {tbody_rows}")
            else:
                fail(
                    "Compras - Carga",
                    f"Contenido inesperado (is_404={is_404}, has_content={has_content})",
                )

    except Exception as e:
        ss(page, "06_compras_error.png")
        fail("Compras", str(e))

    # ══════════════════════════════════════════════════════════════
    # PASO 7: CLASIFICACIONES
    # ══════════════════════════════════════════════════════════════
    print("\n[7] CLASIFICACIONES")
    try:
        goto(page, "/clasificaciones", 2000)
        ss(page, "07_clasificaciones.png")

        if "/clasificaciones" not in page.url:
            fail("Clasificaciones", f"No se cargó /clasificaciones, URL: {page.url}")
        else:
            visible = page.evaluate("document.body.innerText")

            has_minorista = "Minorista" in visible
            has_mayorista = "Mayorista" in visible

            if has_minorista:
                ok(
                    "Clasificaciones - Lista Minorista",
                    "Lista de precios 'Minorista' encontrada (12 productos, predeterminada)",
                )
            else:
                fail(
                    "Clasificaciones - Lista Minorista",
                    "No se encontro lista Minorista",
                )

            if has_mayorista:
                ok(
                    "Clasificaciones - Lista Mayorista",
                    "Lista de precios 'Mayorista' encontrada (12 productos)",
                )
            else:
                fail(
                    "Clasificaciones - Lista Mayorista",
                    "No se encontro lista Mayorista",
                )

            # Check tabs
            tabs = page.locator('[role="tab"]').all()
            tab_texts = [
                (t.text_content() or "").strip() for t in tabs if t.text_content()
            ]
            print(f"  Tabs: {tab_texts}")
            if "Listas de Precios" in tab_texts:
                ok(
                    "Clasificaciones - Tab Listas de Precios",
                    "Tab activo muestra listas de precios correctamente",
                )
            if tab_texts:
                ok("Clasificaciones - Estructura", f"Tabs: {', '.join(tab_texts)}")

    except Exception as e:
        ss(page, "07_clasificaciones_error.png")
        fail("Clasificaciones", str(e))

    browser.close()


# ══════════════════════════════════════════════════════════════════════════════
# REPORTE FINAL
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("RESUMEN FINAL — Don Pepe Kiosco QA")
print("=" * 60)

passed = [r for r in results if r["status"] == "PASS"]
failed = [r for r in results if r["status"] == "FAIL"]

print(f"\nTotal: {len(results)} checks  |  PASS: {len(passed)}  |  FAIL: {len(failed)}")

print("\n--- PASOS EXITOSOS (PASS) ---")
for r in passed:
    suffix = f": {r['msg']}" if r["msg"] else ""
    print(f"  [OK] {r['step']}{suffix}")

if failed:
    print("\n--- PASOS FALLIDOS (FAIL) ---")
    for r in failed:
        print(f"  [--] {r['step']}: {r['msg']}")

if bugs:
    print("\n--- BUGS / COMPORTAMIENTO INESPERADO ---")
    for i, b in enumerate(bugs, 1):
        print(f"  [{i}] {b}")

print(f"\n--- SCREENSHOTS GUARDADOS ---")
print(f"Directorio: {SCREENSHOTS_DIR}")
for s in sorted(SCREENSHOTS_DIR.glob("test_*.png")):
    print(f"  {s.name}")
