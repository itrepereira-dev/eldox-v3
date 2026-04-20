"""
E2E Audit do Eldox SaaS — roda todas as rotas conhecidas e relata erros.

Uso:
    ELDOX_URL=https://sistema.eldox.com.br \
    ELDOX_SLUG=eldox \
    ELDOX_EMAIL=itrepereira@gmail.com \
    ELDOX_SENHA='...' \
    python3 audit_eldox.py

Saida:
    - report.md com a lista de erros e achados (prioridade + evidencia)
    - screenshots/*.png das telas visitadas
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext, Error as PwError

ROOT = Path(__file__).parent
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)

BASE_URL = os.environ.get("ELDOX_URL", "https://sistema.eldox.com.br").rstrip("/")
SLUG     = os.environ.get("ELDOX_SLUG", "eldox")
EMAIL    = os.environ.get("ELDOX_EMAIL", "itrepereira@gmail.com")
SENHA    = os.environ.get("ELDOX_SENHA", "")

if not SENHA:
    print("ERRO: defina ELDOX_SENHA no ambiente.", file=sys.stderr)
    sys.exit(2)

# Rotas extraidas de frontend-web/src/App.tsx. Comentarios indicam o modulo.
# :id/:obraId/etc. serao substituidos em runtime via resolve_placeholders().
ROUTES = [
    # Sem autenticacao (publicas) nao precisam ser rodadas aqui
    # --- Dashboard ---
    {"path": "/dashboard",                              "modulo": "Dashboard",       "tipo": "list"},
    # --- Obras ---
    {"path": "/obras",                                  "modulo": "Obras",           "tipo": "list"},
    {"path": "/obras/nova",                             "modulo": "Obras",           "tipo": "form"},
    {"path": "/obras/{obraId}",                         "modulo": "Obras",           "tipo": "detail"},
    # --- GED por obra ---
    {"path": "/obras/{obraId}/ged",                     "modulo": "GED",             "tipo": "hub"},
    {"path": "/obras/{obraId}/ged/documentos",          "modulo": "GED",             "tipo": "list"},
    {"path": "/obras/{obraId}/ged/lista-mestra",        "modulo": "GED",             "tipo": "list"},
    # --- GED admin ---
    {"path": "/ged/admin",                              "modulo": "GED",             "tipo": "admin"},
    # --- FVS catalogo + modelos ---
    {"path": "/configuracoes/fvs/catalogo",             "modulo": "FVS",             "tipo": "catalogo"},
    {"path": "/fvs/modelos",                            "modulo": "FVS",             "tipo": "list"},
    {"path": "/fvs/modelos/novo",                       "modulo": "FVS",             "tipo": "form"},
    # --- FVS inspecao ---
    {"path": "/fvs/fichas",                             "modulo": "FVS",             "tipo": "list"},
    {"path": "/fvs/fichas/nova",                        "modulo": "FVS",             "tipo": "wizard"},
    {"path": "/fvs/dashboard",                          "modulo": "FVS",             "tipo": "dashboard"},
    {"path": "/obras/{obraId}/fvs/dashboard",           "modulo": "FVS",             "tipo": "dashboard"},
    # --- FVM ---
    {"path": "/fvm/catalogo",                           "modulo": "FVM",             "tipo": "list"},
    {"path": "/fvm/fornecedores",                       "modulo": "FVM",             "tipo": "list"},
    {"path": "/fvm/obras/{obraId}",                     "modulo": "FVM",             "tipo": "grade"},
    # --- Diario / RDO ---
    {"path": "/diario",                                 "modulo": "Diario",          "tipo": "home"},
    {"path": "/obras/{obraId}/diario",                  "modulo": "Diario",          "tipo": "list"},
    # --- Ensaios ---
    {"path": "/configuracoes/ensaios/tipos",            "modulo": "Ensaios",         "tipo": "list"},
    {"path": "/obras/{obraId}/ensaios",                 "modulo": "Ensaios",         "tipo": "dashboard"},
    {"path": "/obras/{obraId}/ensaios/laboratoriais",   "modulo": "Ensaios",         "tipo": "list"},
    {"path": "/obras/{obraId}/ensaios/revisoes",        "modulo": "Ensaios",         "tipo": "list"},
    # --- Concretagem ---
    {"path": "/concretagem",                            "modulo": "Concretagem",     "tipo": "dashboard"},
    {"path": "/concretagem/concretagens",               "modulo": "Concretagem",     "tipo": "list"},
    {"path": "/obras/{obraId}/concretagem",             "modulo": "Concretagem",     "tipo": "dashboard"},
    {"path": "/obras/{obraId}/concretagem/concretagens","modulo": "Concretagem",     "tipo": "list"},
    {"path": "/obras/{obraId}/concretagem/croqui",      "modulo": "Concretagem",     "tipo": "croqui"},
    # --- Almoxarifado ---
    {"path": "/almoxarifado",                           "modulo": "Almoxarifado",    "tipo": "dashboard"},
    {"path": "/almoxarifado/estoque",                   "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/estoque/movimentos",        "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/estoque/alertas",           "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/transferencias",            "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/locais",                    "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/conversoes",                "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/solicitacoes",              "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/solicitacoes/nova",         "modulo": "Almoxarifado",    "tipo": "form"},
    {"path": "/almoxarifado/ocs",                       "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/ocs/nova",                  "modulo": "Almoxarifado",    "tipo": "form"},
    {"path": "/almoxarifado/nfes",                      "modulo": "Almoxarifado",    "tipo": "list"},
    {"path": "/almoxarifado/nfes/upload",               "modulo": "Almoxarifado",    "tipo": "form"},
    {"path": "/almoxarifado/planejamento",              "modulo": "Almoxarifado",    "tipo": "tool"},
    {"path": "/almoxarifado/insights",                  "modulo": "Almoxarifado",    "tipo": "ia"},
    # --- NCs ---
    {"path": "/ncs",                                    "modulo": "NC",              "tipo": "list"},
    {"path": "/obras/{obraId}/ncs",                     "modulo": "NC",              "tipo": "list"},
    # --- Semaforo ---
    {"path": "/semaforo",                               "modulo": "Semaforo",        "tipo": "dashboard"},
    {"path": "/obras/{obraId}/semaforo",                "modulo": "Semaforo",        "tipo": "dashboard"},
    # --- Aprovacoes ---
    {"path": "/aprovacoes",                             "modulo": "Aprovacoes",      "tipo": "list"},
    {"path": "/aprovacoes/templates",                   "modulo": "Aprovacoes",      "tipo": "list"},
    # --- Efetivo ---
    {"path": "/obras/{obraId}/efetivo",                 "modulo": "Efetivo",         "tipo": "list"},
    {"path": "/configuracoes/efetivo/cadastros",        "modulo": "Efetivo",         "tipo": "catalogo"},
    # --- Planos de acao ---
    {"path": "/obras/{obraId}/fvs/planos-acao",         "modulo": "PlanosAcao",      "tipo": "list"},
    {"path": "/configuracoes/planos-acao",              "modulo": "PlanosAcao",      "tipo": "config"},
    # --- Admin ---
    {"path": "/admin/usuarios",                         "modulo": "Admin",           "tipo": "list"},
    {"path": "/admin/usuarios/novo",                    "modulo": "Admin",           "tipo": "form"},
    {"path": "/admin/perfis-acesso",                    "modulo": "Admin",           "tipo": "list"},
]


@dataclass
class Finding:
    severity: str       # CRIT, ALTO, MEDIO, BAIXO, INFO
    modulo: str
    path: str
    category: str       # console, network, http, ui, navigation
    summary: str
    details: str = ""
    screenshot: Optional[str] = None


@dataclass
class RouteResult:
    path: str
    resolved_path: str
    modulo: str
    http_status: Optional[int] = None
    load_time_ms: int = 0
    console_errors: list = field(default_factory=list)
    console_warnings: list = field(default_factory=list)
    page_errors: list = field(default_factory=list)
    failed_requests: list = field(default_factory=list)
    rendered_title: str = ""
    screenshot: str = ""
    note: str = ""


def resolve_placeholders(route_path: str, ids: dict) -> str:
    """Substitui {obraId}, {id}, {fichaId}, etc."""
    out = route_path
    for key, value in ids.items():
        out = out.replace("{" + key + "}", str(value))
    return out


def safe_slug(path: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", path.lower()).strip("_") or "root"


def login(page: Page) -> bool:
    page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30_000)
    # Campo empresa/slug
    try:
        page.get_by_placeholder("identificador-da-empresa").fill(SLUG)
        page.get_by_placeholder("seu@email.com").fill(EMAIL)
        page.get_by_placeholder("••••••••").fill(SENHA)
        page.get_by_role("button", name=re.compile(r"entrar|login|acessar", re.I)).click()
    except Exception as e:
        print(f"[login] erro ao preencher formulario: {e}")
        return False

    # Espera navegar para /dashboard
    try:
        page.wait_for_url(re.compile(r"/dashboard"), timeout=20_000)
        return True
    except PwError:
        # Pode estar ainda em /login com erro
        current = page.url
        print(f"[login] nao navegou para dashboard. URL atual: {current}")
        try:
            err = page.locator("text=Credenciais invalidas").first
            if err.count() > 0:
                print("[login] credenciais invalidas")
        except Exception:
            pass
        return False


def discover_first_obra(page: Page, api_token: str) -> Optional[str]:
    """Pega o primeiro obraId da API para usar nas rotas com placeholder."""
    try:
        resp = page.evaluate("""async (base) => {
            const token = localStorage.getItem('eldox_token');
            if (!token) return { status: 0, body: 'sem token no localStorage' };
            const r = await fetch(base + '/api/v1/obras', {
                headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
            });
            if (!r.ok) return { status: r.status, body: await r.text() };
            const data = await r.json();
            return { status: 200, data: data };
        }""", BASE_URL)
        if isinstance(resp, dict) and resp.get("status") == 200:
            data = resp.get("data")
            items = data if isinstance(data, list) else (data.get("data") or data.get("items") or data.get("obras") or [])
            if items and isinstance(items, list) and len(items) > 0:
                first = items[0]
                return first.get("id") or first.get("obraId") or first.get("uuid")
        print(f"[obras] resposta: {json.dumps(resp)[:300]}")
    except Exception as e:
        print(f"[obras] erro ao buscar: {e}")
    return None


def discover_obra_via_ui(page: Page) -> Optional[str]:
    """Plano B: navega para /obras e extrai o primeiro link /obras/:id da lista."""
    try:
        page.goto(f"{BASE_URL}/obras", wait_until="domcontentloaded", timeout=20_000)
        page.wait_for_load_state("networkidle", timeout=10_000)
        # Procura qualquer link href="/obras/<id>" que nao seja /obras/nova
        hrefs = page.evaluate("""() => Array.from(document.querySelectorAll('a[href^="/obras/"]')).map(a => a.getAttribute('href')).filter(h => h && !h.endsWith('/nova') && !h.endsWith('/obras'))""")
        for href in hrefs or []:
            m = re.match(r"^/obras/([^/]+)$", href or "")
            if m:
                return m.group(1)
            m = re.match(r"^/obras/([^/]+)/", href or "")
            if m and m.group(1) != "nova":
                return m.group(1)
    except Exception as e:
        print(f"[obras-ui] erro: {e}")
    return None


def run_route(page: Page, route: dict, ids: dict, results: list, findings: list):
    resolved = resolve_placeholders(route["path"], ids)
    # Se ainda houver placeholder, pula
    if "{" in resolved:
        findings.append(Finding(
            severity="INFO",
            modulo=route["modulo"],
            path=route["path"],
            category="setup",
            summary=f"Rota dependente de ID nao resolvido: {resolved}",
            details="Nao foi possivel obter o ID necessario via API; rota pulada.",
        ))
        return

    r = RouteResult(path=route["path"], resolved_path=resolved, modulo=route["modulo"])

    # Listeners (limpo por rota)
    console_errors = []
    console_warnings = []
    page_errors = []
    failed_requests = []

    def on_console(msg):
        # Filtra ruidos conhecidos
        txt = msg.text
        if "Failed to load resource" in txt and "favicon" in txt:
            return
        if msg.type == "error":
            console_errors.append(txt[:500])
        elif msg.type == "warning":
            # Filtra React dev warnings comuns
            if any(w in txt for w in ("DevTools", "Download the React", "Lit is in dev mode")):
                return
            console_warnings.append(txt[:500])

    def on_page_error(exc):
        page_errors.append(str(exc)[:800])

    def on_request_failed(req):
        # Ignora requests que falham por abort proposital
        if req.failure and "aborted" in (req.failure or "").lower():
            return
        failed_requests.append({
            "url": req.url,
            "method": req.method,
            "failure": req.failure,
        })

    def on_response(resp):
        # Captura status HTTP >= 400 em chamadas da API do eldox
        try:
            if resp.status >= 400 and "/api/" in resp.url:
                failed_requests.append({
                    "url": resp.url,
                    "method": resp.request.method,
                    "status": resp.status,
                })
        except Exception:
            pass

    page.on("console", on_console)
    page.on("pageerror", on_page_error)
    page.on("requestfailed", on_request_failed)
    page.on("response", on_response)

    url = f"{BASE_URL}{resolved}"
    t0 = time.time()
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        r.http_status = response.status if response else None
        # Aguarda um pouco mais por carregamento de dados
        try:
            page.wait_for_load_state("networkidle", timeout=10_000)
        except PwError:
            r.note = "networkidle timeout"
    except PwError as e:
        r.note = f"goto falhou: {str(e)[:200]}"
        findings.append(Finding(
            severity="CRIT",
            modulo=route["modulo"],
            path=resolved,
            category="navigation",
            summary="Tela nao carregou (timeout/erro no goto)",
            details=r.note,
        ))
        page.remove_listener("console", on_console)
        page.remove_listener("pageerror", on_page_error)
        page.remove_listener("requestfailed", on_request_failed)
        page.remove_listener("response", on_response)
        return
    finally:
        r.load_time_ms = int((time.time() - t0) * 1000)

    # Captura titulo renderizado (H1 principal geralmente)
    try:
        h1 = page.locator("h1, h2").first
        if h1.count() > 0:
            r.rendered_title = (h1.text_content() or "").strip()[:120]
    except Exception:
        pass

    # Screenshot
    shot_path = SHOTS / f"{safe_slug(resolved)}.png"
    try:
        page.screenshot(path=str(shot_path), full_page=True)
        r.screenshot = str(shot_path.relative_to(ROOT))
    except Exception:
        pass

    # Detecta tela em branco / "Carregando…" eterno / tela de erro
    try:
        body_text = (page.locator("body").text_content() or "").strip()
        lower = body_text.lower()
        if len(body_text) < 40:
            findings.append(Finding(
                severity="ALTO",
                modulo=route["modulo"],
                path=resolved,
                category="ui",
                summary="Tela praticamente vazia (<40 chars renderizados)",
                details=f"Conteudo: {body_text[:100]}",
                screenshot=r.screenshot,
            ))
        elif "carregando" in lower and len(body_text) < 120:
            findings.append(Finding(
                severity="ALTO",
                modulo=route["modulo"],
                path=resolved,
                category="ui",
                summary="Tela parada em 'Carregando…'",
                details=f"Conteudo renderizado: {body_text[:150]}",
                screenshot=r.screenshot,
            ))
        elif any(sig in lower for sig in (
            "algo deu errado",
            "erro inesperado",
            "something went wrong",
            "unexpected error",
            "500 internal",
        )):
            findings.append(Finding(
                severity="CRIT",
                modulo=route["modulo"],
                path=resolved,
                category="ui",
                summary="Tela exibe mensagem de erro",
                details=body_text[:300],
                screenshot=r.screenshot,
            ))
    except Exception:
        pass

    # Detecta redirect para /login (sessao expirou)
    if page.url.endswith("/login") or "/login" in page.url:
        findings.append(Finding(
            severity="ALTO",
            modulo=route["modulo"],
            path=resolved,
            category="auth",
            summary="Redirecionado para /login durante navegacao (sessao pode ter caido)",
            details=f"URL final: {page.url}",
            screenshot=r.screenshot,
        ))

    # Reporta erros coletados
    for err in page_errors:
        findings.append(Finding(
            severity="CRIT",
            modulo=route["modulo"],
            path=resolved,
            category="runtime",
            summary="Excecao JavaScript nao capturada",
            details=err,
            screenshot=r.screenshot,
        ))

    for err in console_errors:
        # Erros de React em producao sao compactos ("Minified React error")
        sev = "ALTO" if "Minified React error" in err or "react" in err.lower() else "MEDIO"
        findings.append(Finding(
            severity=sev,
            modulo=route["modulo"],
            path=resolved,
            category="console",
            summary=f"console.error: {err[:80]}",
            details=err,
            screenshot=r.screenshot,
        ))

    # Agrupa falhas de rede por URL para nao spamar
    seen = set()
    for fr in failed_requests:
        key = (fr.get("url", "").split("?")[0], fr.get("status") or fr.get("failure"))
        if key in seen:
            continue
        seen.add(key)
        status = fr.get("status")
        sev = "CRIT" if status in (500, 502, 503) else ("ALTO" if status and status >= 400 else "MEDIO")
        findings.append(Finding(
            severity=sev,
            modulo=route["modulo"],
            path=resolved,
            category="network",
            summary=f"Request {fr.get('method','?')} {key[0].split('/api/v1/')[-1][:60]} falhou ({status or fr.get('failure')})",
            details=json.dumps(fr)[:500],
            screenshot=r.screenshot,
        ))

    r.console_errors = console_errors
    r.console_warnings = console_warnings
    r.page_errors = page_errors
    r.failed_requests = failed_requests
    results.append(r)

    # Remove listeners
    page.remove_listener("console", on_console)
    page.remove_listener("pageerror", on_page_error)
    page.remove_listener("requestfailed", on_request_failed)
    page.remove_listener("response", on_response)


def audit_sidebar(page: Page, findings: list):
    """Extrai todos os links do sidebar + topbar e confere para onde apontam."""
    try:
        hrefs = page.evaluate("""() => {
            const out = [];
            document.querySelectorAll('a[href]').forEach(a => {
                const href = a.getAttribute('href') || '';
                if (!href.startsWith('/')) return;
                const label = (a.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
                out.push({ href, label });
            });
            return out;
        }""")
    except Exception as e:
        findings.append(Finding(
            severity="MEDIO", modulo="Navegacao", path="/",
            category="navigation",
            summary="Nao consegui extrair links da shell",
            details=str(e)[:200],
        ))
        return []
    # Remove duplicatas
    seen = set()
    uniq = []
    for h in hrefs:
        if h["href"] in seen:
            continue
        seen.add(h["href"])
        uniq.append(h)
    return uniq


def gen_report(findings: list, results: list, sidebar_links: list):
    # Agrupa por severidade
    order = {"CRIT": 0, "ALTO": 1, "MEDIO": 2, "BAIXO": 3, "INFO": 4}
    findings.sort(key=lambda f: (order.get(f.severity, 9), f.modulo, f.path))

    counts = {}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    lines = [
        f"# Auditoria E2E Eldox — {BASE_URL}",
        "",
        f"- Data/hora: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- Rotas visitadas: {len(results)}",
        f"- Achados totais: {len(findings)}",
        f"- Distribuicao: " + " · ".join(f"{k}:{v}" for k, v in sorted(counts.items(), key=lambda x: order.get(x[0], 9))),
        "",
        "## Resumo por modulo",
        "",
        "| Modulo | Rotas | Erros console | Erros runtime | Falhas rede | Status |",
        "|---|---|---|---|---|---|",
    ]
    by_mod = {}
    for r in results:
        m = by_mod.setdefault(r.modulo, {"rotas": 0, "console": 0, "runtime": 0, "rede": 0})
        m["rotas"] += 1
        m["console"] += len(r.console_errors)
        m["runtime"] += len(r.page_errors)
        m["rede"] += len(r.failed_requests)
    for modulo, v in sorted(by_mod.items()):
        status = "OK" if (v["console"] + v["runtime"] + v["rede"]) == 0 else ("QUEBRADO" if v["runtime"] else "AVISO")
        lines.append(f"| {modulo} | {v['rotas']} | {v['console']} | {v['runtime']} | {v['rede']} | {status} |")

    lines += ["", "## Achados por severidade", ""]
    for sev in ("CRIT", "ALTO", "MEDIO", "BAIXO", "INFO"):
        block = [f for f in findings if f.severity == sev]
        if not block:
            continue
        lines.append(f"### {sev} ({len(block)})")
        lines.append("")
        for i, f in enumerate(block, 1):
            lines.append(f"**[{sev}{i:03d}] {f.modulo} — {f.path}**")
            lines.append(f"- Categoria: `{f.category}`")
            lines.append(f"- Resumo: {f.summary}")
            if f.details:
                d = f.details.replace("\n", " ")[:400]
                lines.append(f"- Detalhes: `{d}`")
            if f.screenshot:
                lines.append(f"- Screenshot: `{f.screenshot}`")
            lines.append("")

    lines += ["", "## Rotas visitadas (detalhe)", ""]
    lines.append("| Modulo | Rota | HTTP | Load (ms) | Titulo renderizado | Obs |")
    lines.append("|---|---|---|---|---|---|")
    for r in results:
        titulo = (r.rendered_title or "").replace("|", "/")[:60]
        lines.append(f"| {r.modulo} | `{r.resolved_path}` | {r.http_status} | {r.load_time_ms} | {titulo} | {r.note} |")

    if sidebar_links:
        lines += ["", "## Links expostos na shell (sidebar + topbar)", ""]
        lines.append("| Href | Label |")
        lines.append("|---|---|")
        for l in sidebar_links:
            lines.append(f"| `{l['href']}` | {l['label']} |")

    report_path = ROOT / "report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main():
    findings: list = []
    results: list = []
    sidebar_links: list = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
        )
        page = context.new_page()

        print(f"→ Login em {BASE_URL} como {EMAIL} (tenant {SLUG})")
        ok = login(page)
        if not ok:
            findings.append(Finding(
                severity="CRIT",
                modulo="Auth",
                path="/login",
                category="auth",
                summary="Login falhou — nao foi possivel prosseguir com a auditoria.",
                details=f"URL final: {page.url}",
            ))
            try:
                page.screenshot(path=str(SHOTS / "login_fail.png"), full_page=True)
            except Exception:
                pass
            gen_report(findings, results, sidebar_links)
            browser.close()
            return

        print("✓ Login OK")
        # Aguarda dashboard carregar
        try:
            page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass

        # Captura links do sidebar no estado autenticado
        sidebar_links = audit_sidebar(page, findings)
        print(f"→ {len(sidebar_links)} links encontrados na shell")

        # Descobre um obraId para rotas parametricas
        obra_id = discover_first_obra(page, "")
        if not obra_id:
            print("→ fallback: buscando obraId via UI em /obras…")
            obra_id = discover_obra_via_ui(page)
        ids = {}
        if obra_id:
            ids["obraId"] = obra_id
            ids["id"] = obra_id
            print(f"✓ obraId para testes: {obra_id}")
        else:
            findings.append(Finding(
                severity="ALTO",
                modulo="Obras",
                path="/obras",
                category="data",
                summary="Nao ha nenhuma obra cadastrada (ou a listagem retornou erro)",
                details="Rotas dependentes de obraId serao puladas.",
            ))

        # Roda todas as rotas
        for i, route in enumerate(ROUTES, 1):
            print(f"[{i:02d}/{len(ROUTES)}] {route['path']}")
            try:
                run_route(page, route, ids, results, findings)
            except Exception as e:
                findings.append(Finding(
                    severity="ALTO",
                    modulo=route["modulo"],
                    path=route["path"],
                    category="runtime",
                    summary="Excecao no runner durante a rota",
                    details=str(e)[:400],
                ))

        print(f"✓ Auditoria concluida. Gerando report.md…")
        report_path = gen_report(findings, results, sidebar_links)
        print(f"→ Relatorio: {report_path}")

        # Salva tambem um JSON para consulta programatica
        (ROOT / "findings.json").write_text(
            json.dumps([asdict(f) for f in findings], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        browser.close()


if __name__ == "__main__":
    main()
