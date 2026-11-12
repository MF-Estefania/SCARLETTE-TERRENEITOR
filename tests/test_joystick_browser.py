"""Integracion del panel real con API simulada. Ejecutar: python tests/test_joystick_browser.py."""
import json
import pathlib
import sys
import tempfile

from test_lights_browser import fixture

CHECKS = r"""async () => {
  const checks = [];
  const check = (value, name) => { if (!value) throw Error(name); checks.push(name); };
  const flush = async () => { for (let i=0; i<30; i++) await Promise.resolve(); };
  const center = document.querySelector('.joystick-center');
  const joystick = document.querySelector('.joystick');
  window.alerts = []; window.alert = message => alerts.push(message);
  document.body.style.visibility = 'visible';
  document.dispatchEvent(new Event('scarlette:sesion-verificada'));
  document.dispatchEvent(new Event('scarlette:sesion-verificada'));
  await flush();
  // Captura simulada para inyectar las tres terminaciones de manera determinista.
  // Las pruebas de mouse y tacto debajo usan captura real del navegador.
  let captured = false;
  center.setPointerCapture = () => { captured = true; };
  center.hasPointerCapture = () => captured;
  center.releasePointerCapture = id => {
    captured = false;
    center.dispatchEvent(new PointerEvent('lostpointercapture', {pointerId:id}));
  };
  const emit = (type, x=100, y=100) => center.dispatchEvent(new PointerEvent(type,
    {pointerId:1, isPrimary:true, button:0, clientX:x, clientY:y}));
  const start = () => emit('pointerdown');
  const move = (x=100,y=50) => emit('pointermove',x,y);
  const stopCount = () => testCalls.filter(c => c.path.endsWith('/detener')).length;
  const centered = () => center.style.getPropertyValue('--joystick-x') === '0px' &&
    center.style.getPropertyValue('--joystick-y') === '0px' &&
    !center.classList.contains('is-dragging') && !joystick.querySelector('.is-active');
  for (const end of ['pointerup','pointercancel','lostpointercapture']) {
    const n = testCalls.length, s = stopCount();
    start(); move(); move();
    check(testCalls.length === n+1, end+': una orden al mantener direccion');
    testCalls[n].resolve({}); await flush();
    move(); check(testCalls.length === n+1, end+': sin repeticion tras respuesta');
    emit(end); emit('pointerup'); emit('pointercancel'); emit('lostpointercapture');
    check(stopCount() === s+1, end+': un unico STOP');
    check(centered(), end+': retorno visual al centro');
    testCalls.at(-1).resolve({}); await flush();
  }
  const empty = testCalls.length;
  for (const end of ['pointerup','pointercancel','lostpointercapture']) { start(); emit(end); }
  check(testCalls.length === empty, 'sin direccion no hay STOP');
  let n = testCalls.length;
  start(); move(); move(150,100); move(150,100); move(50,100); move(50,100);
  check(testCalls.length === n+1, 'cambios rapidos conservan una peticion en vuelo');
  testCalls[n].resolve({}); await flush();
  check(testCalls.length === n+2 && JSON.parse(testCalls.at(-1).options.body).id_comando === 36,
    'solo se procesa la ultima direccion pendiente');
  testCalls.at(-1).resolve({}); await flush(); emit('pointerup');
  testCalls.at(-1).resolve({}); await flush();
  n = testCalls.length;
  start(); move(); move(150,100); emit('pointerup');
  check(testCalls.length === n+2 && testCalls[n+1].path.endsWith('/detener'), 'STOP inmediato con movimiento pendiente');
  testCalls[n+1].resolve({}); await flush();
  testCalls[n].resolve({}); await flush();
  check(testCalls.length === n+3 && testCalls[n+2].path.endsWith('/detener'), 'contrato existente reafirma STOP tras movimiento en vuelo');
  testCalls[n+2].resolve({}); await flush();
  check(testCalls.length === n+3, 'movimiento anterior y pendiente no reactivan la cola');
  start(); move(); testCalls.at(-1).resolve({}); await flush(); emit('pointerup');
  testCalls.at(-1).reject(new Error('red simulada')); await flush();
  check(alerts.length === 1 && alerts[0].includes('No se pudo confirmar STOP') && alerts[0].includes('red simulada'), 'fallo STOP visible sin afirmar parada fisica');
  check(centered(), 'error STOP conserva centro visual');
  n = testCalls.length;
  document.querySelector('.movement[data-command="27"]').click();
  check(testCalls.length === n, 'fallo STOP bloquea movimientos');
  document.querySelector('.emergency-stop').click();
  check(testCalls.length === n+1 && testCalls.at(-1).path.endsWith('/detener'), 'DETENER independiente permite reintentar');
  testCalls.at(-1).resolve({}); await flush();
  const buttons = [...document.querySelectorAll('.movement')];
  check(buttons.length === 8, 'ocho botones adicionales');
  for (const button of buttons) {
    n = testCalls.length; button.click();
    check(testCalls.length === n+1 && JSON.parse(testCalls[n].options.body).id_comando === Number(button.dataset.command), 'comando intacto '+button.dataset.command);
    testCalls[n].resolve({}); await flush();
    button.dispatchEvent(new PointerEvent('pointerup', {pointerId:2}));
    check(testCalls.length === n+1, 'liberar adicional no envia STOP '+button.dataset.command);
  }
  const selector = document.getElementById('demo');
  selector.appendChild(new Option('DEMO simulada', '9')); selector.value = '9';
  n = testCalls.length;
  document.querySelector('.demo-card .neon-button').click();
  check(testCalls.length === n+1 && testCalls[n].path === '/vehiculos/7/demos/9/iniciar', 'DEMO iniciar conserva endpoint');
  testCalls[n].resolve({}); await flush();
  document.querySelector('.demo-card .outline-button').click();
  check(testCalls.length === n+2 && testCalls[n+1].path === '/vehiculos/7/demos/cancelar', 'DEMO cancelar conserva endpoint');
  testCalls[n+1].resolve({}); await flush();
  check(testErrors.length === 0, 'sin errores JS ni rechazos sin manejar');
  return {ok:true, assertions:checks.length, checks};
}"""


def main():
    tools = pathlib.Path(tempfile.gettempdir()) / 'scarlette-browser-tools'
    if tools.exists():
        sys.path.insert(0, str(tools))
    from playwright.sync_api import sync_playwright
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(channel='msedge', headless=True)
        try:
            for width, height in [(1366, 900), (390, 844)]:
                page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
                page.route('**/*', lambda route: route.abort())
                page.set_content(fixture(include_checks=False))
                result = page.evaluate(CHECKS)
                print(json.dumps({'viewport': width, **result}))
                page.close()
                for touch in [False, True]:
                    page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
                    page.route('**/*', lambda route: route.abort())
                    page.set_content(fixture(include_checks=False))
                    page.evaluate("document.body.style.visibility='visible'; document.dispatchEvent(new Event('scarlette:sesion-verificada'))")
                    rect = page.locator('.joystick-center').bounding_box()
                    x, y = rect['x'] + rect['width']/2, rect['y'] + rect['height']/2
                    if touch:
                        session = page.context.new_cdp_session(page)
                        session.send('Input.dispatchTouchEvent', {'type':'touchStart', 'touchPoints':[{'x':x,'y':y}]})
                        session.send('Input.dispatchTouchEvent', {'type':'touchMove', 'touchPoints':[{'x':x,'y':y-35}]})
                    else:
                        page.mouse.move(x,y)
                        page.mouse.down()
                        page.mouse.move(x,y-35)
                    page.wait_for_function('testCalls.length === 1')
                    page.evaluate('testCalls[0].resolve({})')
                    if touch:
                        session.send('Input.dispatchTouchEvent', {'type':'touchEnd', 'touchPoints':[]})
                    else:
                        page.mouse.up()
                    page.wait_for_function('testCalls.length === 2')
                    assert page.evaluate("testCalls[1].path.endsWith('/detener')")
                    assert page.evaluate("document.querySelector('.joystick-center').style.getPropertyValue('--joystick-y') === '0px'")
                    page.evaluate('testCalls[1].resolve({})')
                    assert page.evaluate('testCalls.length') == 2
                    print(json.dumps({'viewport':width, 'input':'touch' if touch else 'mouse', 'ok':True}))
                    page.close()
        finally:
            browser.close()


if __name__ == '__main__':
    main()
