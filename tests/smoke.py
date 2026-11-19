"""Plays a short game in a hidden browser and fails if anything breaks.

Run with python3 tests/smoke.py. Needs playwright with chromium installed.
"""
import functools, http.server, pathlib, socketserver, sys, threading
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=str(root))
server = socketserver.TCPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_address[1]}'
errors, fails = [], []

def check(ok, what):
    print(('ok    ' if ok else 'FAIL  ') + what)
    if not ok: fails.append(what)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1300, 'height': 900})
    desk = ctx.new_page()
    desk.on('pageerror', lambda e: errors.append('desk ' + str(e)))
    desk.on('dialog', lambda d: d.accept())
    desk.goto(base + '/index.html')
    desk.wait_for_timeout(400)
    check('passed' in desk.inner_text('#verify'), 'the model reproduces the published numbers')

    room = ctx.new_page()
    room.on('pageerror', lambda e: errors.append('room ' + str(e)))
    room.goto(base + '/index.html?view=room')
    room.wait_for_timeout(300)

    desk.click('#drawCase')
    desk.click('[data-tab=act1]')
    check(desk.locator('#costTable tr').count() == 5, 'the Act One cost range has four rows')
    for k, v in dict(niYes=5, niNo=3, roiYes=3, roiNo=1).items():
        desk.fill('#' + k, str(v))
    desk.click('#recordPoll')
    desk.click('#startAct2')
    for turn in range(3):
        desk.click('#runTurn')
        desk.click('#drawEvent')
        desk.check('input[name=panel][value="0"]')
        desk.click('#recordTurn')
        desk.click('[data-tab=act2]')
    desk.click('[data-tab=score]')
    check(desk.locator('#act2Table tr').count() == 4, 'the scoreboard has three recorded turns')
    desk.click('[data-tab=debrief]')
    check(desk.locator('#pathTable tr').count() == 26, 'the debrief shows all 25 years')
    desk.click('[data-tab=vote]')
    desk.click('#newVote')
    desk.wait_for_timeout(300)
    check(desk.locator('#voteBox .qr svg').count() == 1, 'the live vote shows a QR code')
    room.wait_for_timeout(300)
    check(room.inner_text('#roomTitle') == 'Live vote', 'the room screen follows the desk')
    desk.click('[data-tab=feedback]')
    check(desk.locator('#qrFeedback svg').count() == 1, 'the feedback tab shows its QR codes')

    phone = browser.new_page(viewport={'width': 390, 'height': 800})
    phone.on('pageerror', lambda e: errors.append('phone ' + str(e)))
    phone.goto(base + '/vote.html?s=pou-smoketest123')
    check(phone.is_visible('#region'), 'the phone vote page opens')
    browser.close()

server.shutdown()
check(not errors, 'no script errors' + ('' if not errors else ', ' + '; '.join(errors)))
if fails:
    sys.exit(f'{len(fails)} check(s) failed')
print('All smoke checks passed.')
