"""Prueba el HTML y JS reales en Edge headless, sin conectar con el vehículo.

Ejecutar: python tests/test_lights_browser.py
Requiere Playwright (pip install playwright) y Edge instalado en Windows.
"""
import json
import pathlib
import re
import tempfile
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

MOCK = r"""
window.testCalls = [];
window.testErrors = [];
window.addEventListener('error', e => testErrors.push(e.message));
window.addEventListener('unhandledrejection', e => testErrors.push(String(e.reason)));
window.SCARLETTE_CONFIG = { VEHICLE_ID: 7 };
window.SCARLETTE_API = { solicitar(path, options) {
  if (path.endsWith('/demos')) return Promise.resolve([]);
  return new Promise((resolve, reject) => testCalls.push({path, options, resolve, reject}));
}};
window.fetch = () => { throw new Error('HTTP real no permitido'); };
window.alert = () => {};
window.lightClickListeners = 0;
const originalAdd = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, callback, options) {
  if (this instanceof Element && this.matches('.movement[data-command="28"]') && type === 'click') lightClickListeners++;
  return originalAdd.call(this, type, callback, options);
};
"""

CHECKS = r"""
(async () => {
  const checks = [];
  function check(condition, name) { if (!condition) throw Error(name); checks.push(name); }
  const flush = async () => { for (let i=0; i<25; i++) await Promise.resolve(); };
  const light = document.querySelector('.movement[data-command="28"]');
  const label = () => light.querySelector('[data-lights-label]').textContent;
  const state = () => light.dataset.lightsState;
  const form = document.getElementById('lights-estimation-form');
  const checkbox = document.getElementById('lights-initial-confirmed');
  const confirm = document.getElementById('lights-confirm-initial');
  const authorize = () => {
    document.getElementById('lights-estimation').open = true;
    if (!checkbox.checked) checkbox.click();
    confirm.click();
  };
  document.body.style.visibility = 'visible';
  document.dispatchEvent(new Event('scarlette:sesion-verificada'));
  document.dispatchEvent(new Event('scarlette:sesion-verificada'));
  await flush();
  check(lightClickListeners === 1, 'un solo manejador click en Control/Luces');
  check(state() === 'unknown' && !checkbox.checked && confirm.disabled, 'sin confirmación automática');
  check(label() === 'Control/Luces', 'etiqueta original');
  const initialShadow = getComputedStyle(light).boxShadow;
  light.click();
  check(testCalls.length === 1, 'un POST sin confirmar');
  testCalls[0].resolve({}); await flush();
  check(state() === 'unknown', 'éxito sin referencia mantiene unknown');
  const n = testCalls.length;
  authorize();
  check(testCalls.length === n, 'confirmación UI no envía comandos');
  check(SCARLETTE_LIGHTS.getEstimatedState().step === 0, 'confirmación UI inicia referencia');
  const size = light.getBoundingClientRect();
  for (let i=0; i<10; i++) {
    const n = testCalls.length;
    light.click();
    check(testCalls.length === n+1, `un POST clic ${i+1}`);
    const call = testCalls[n];
    const body = JSON.parse(call.options.body);
    check(call.path === '/vehiculos/7/movimientos' && call.options.method === 'POST' && body.id_comando === 28 && body.origen === 'scarlette_web', `contrato numérico28 clic ${i+1}`);
    const oldState = state();
    await flush();
    check(state() === oldState, `sin adelanto antes de HTTP clic ${i+1}`);
    call.resolve({}); await flush();
    const expected = i%2 === 0 ? 'on' : 'off';
    check(state() === expected && light.classList.contains('lights-active') === (expected === 'on'), `respuesta y clase ${expected} clic ${i+1}`);
    check(label() === 'Control/Luces', `etiqueta fija clic ${i+1}`);
    check(getComputedStyle(light).boxShadow !== initialShadow === (expected === 'on'), `CSS calculado ${expected} clic ${i+1}`);
    const rect = light.getBoundingClientRect();
    check(rect.width === size.width && rect.height === size.height, `dimensiones intactas clic ${i+1}`);
  }
  light.click(); testCalls.at(-1).resolve({}); await flush();
  const stopCount = testCalls.length;
  document.querySelector('.emergency-stop').click();
  check(testCalls.length === stopCount+1 && testCalls.at(-1).path.endsWith('/detener'), 'STOP conserva endpoint');
  testCalls.at(-1).resolve({}); await flush();
  check(state() === 'on', 'STOP no altera luces');
  const fastCount = testCalls.length;
  light.click(); light.click();
  check(testCalls.length === fastCount+1, 'clics rápidos sin duplicar HTTP en vuelo');
  check(confirm.disabled, 'no se confirma referencia durante petición');
  testCalls.at(-1).resolve({}); await flush();
  check(state() === 'off', 'clics rápidos avanzan una vez');
  light.click(); testCalls.at(-1).reject(new Error('HTTP 500 simulado')); await flush();
  check(state() === 'unknown' && !light.classList.contains('lights-active'), 'error invalida estimación');
  check(!checkbox.checked, 'error exige confirmación nueva');
  // Conservar y completar las paradas de seguridad existentes en controls.js.
  testCalls.at(-1).resolve({}); await flush();
  testCalls.at(-1).resolve({}); await flush();
  for (const button of document.querySelectorAll('.movement:not([data-command="28"])')) {
    check(!button.disabled, `comando ${button.dataset.command} habilitado`);
    const n = testCalls.length; button.click();
    check(testCalls.length === n+1 && JSON.parse(testCalls[n].options.body).id_comando === Number(button.dataset.command), `comando ${button.dataset.command} intacto`);
    testCalls[n].resolve({}); await flush();
  }
  const beforeReconfirm = testCalls.length;
  authorize();
  check(testCalls.length === beforeReconfirm && SCARLETTE_LIGHTS.getEstimatedState().step === 0, 'reconfirmación UI sin HTTP');
  light.click(); testCalls.at(-1).resolve({}); await flush();
  check(state() === 'on', 'tras reconfirmar primer clic ON');
  check(testErrors.length === 0, 'sin errores JS ni rechazos sin manejar');
  return {ok:true, assertions:checks.length, viewport:innerWidth, shadow:getComputedStyle(light).boxShadow, checks};
})().then(result => {
  const out = document.createElement('pre'); out.id='scarlette-test-results'; out.textContent=JSON.stringify(result); document.body.append(out);
}, error => {
  const out = document.createElement('pre'); out.id='scarlette-test-results'; out.textContent=JSON.stringify({ok:false,error:error.stack}); document.body.append(out);
});
"""


def fixture(include_checks=True):
    panel = (ROOT / 'panel.html').read_text(encoding='utf-8')
    # Sustituir únicamente scripts: se usa el marcado del panel y el CSS reales.
    def script(match):
        path = match.group(1).split('?')[0]
        if path in ['assets/js/controls.js', 'assets/js/lights.js']:
            return '<script>' + (ROOT / path).read_text(encoding='utf-8') + '</script>'
        return ''
    panel = re.sub(r'<script src="([^"]+)"></script>', script, panel)
    panel = re.sub(r'<link\b[^>]*>', '', panel)
    panel = re.sub(r'<img\b[^>]*>', '', panel)
    css = (ROOT / 'assets/css/styles.css').read_text(encoding='utf-8')
    panel = panel.replace('</head>', '<style>' + css + '</style><script>' + MOCK + '</script></head>')
    return panel.replace('</body>', '<script>' + CHECKS + '</script></body>') if include_checks else panel


def pointer_flow(browser, width, height):
    page = browser.new_page(viewport={'width': width, 'height': height})
    page.route('**/*', lambda route: route.abort())
    page.set_content(fixture(include_checks=False))
    page.evaluate("document.body.style.visibility='visible'; document.dispatchEvent(new Event('scarlette:sesion-verificada'))")
    page.locator('#lights-estimation summary').click()
    page.locator('#lights-initial-confirmed').check()
    page.locator('#lights-confirm-initial').click()
    assert page.evaluate('testCalls.length') == 0
    light = page.locator('.movement[data-command="28"]')
    for index in range(10):
        light.click()
        assert page.evaluate('testCalls.length') == index + 1
        assert page.evaluate('JSON.parse(testCalls.at(-1).options.body).id_comando') == 28
        page.evaluate('testCalls.at(-1).resolve({})')
        expected = 'on' if index % 2 == 0 else 'off'
        page.wait_for_function("(state) => document.querySelector('[data-command=\"28\"]').dataset.lightsState === state", arg=expected)
        assert light.locator('[data-lights-label]').inner_text() == 'Control/Luces'
        assert ('lights-active' in light.get_attribute('class')) == (expected == 'on')
    assert page.evaluate('lightClickListeners') == 1
    print(json.dumps({'ok': True, 'viewport': width, 'pointer_clicks': 10, 'result': 'Playwright pointer clicks -> controls POST28 -> promise -> lights -> CSS'}))
    page.close()


def main():
    # Permite usar una instalacion temporal sin tocar las dependencias del proyecto.
    temporary_tools = pathlib.Path(tempfile.gettempdir()) / 'scarlette-browser-tools'
    if temporary_tools.exists():
        sys.path.insert(0, str(temporary_tools))
    from playwright.sync_api import sync_playwright
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(channel='msedge', headless=True)
        try:
            for width, height in [(1366, 900), (390, 844)]:
                page = browser.new_page(viewport={'width': width, 'height': height})
                page.route('**/*', lambda route: route.abort())
                page.set_content(fixture())
                page.wait_for_selector('#scarlette-test-results', state='attached', timeout=15000)
                result = json.loads(page.locator('#scarlette-test-results').text_content())
                print(json.dumps({key: value for key, value in result.items() if key != 'checks'}, ensure_ascii=True))
                page.close()
                if not result['ok']:
                    raise SystemExit(1)
                pointer_flow(browser, width, height)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
