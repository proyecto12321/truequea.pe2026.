<?php
/* =====================================================================
   TRUEQUEA PE — api.php
   ---------------------------------------------------------------------
   Este archivo es OPCIONAL.

   · Si abres index.html con doble clic, la web funciona igual y guarda
     todo en el navegador de esa computadora.
   · Si subes los 4 archivos a un hosting con PHP (o los pones en
     htdocs de XAMPP), este archivo guarda la base de datos en el
     servidor y TODAS las personas ven lo mismo desde cualquier equipo.

   No necesita MySQL: guarda un archivo JSON al costado.

   Acciones:
     GET  api.php?a=estado    → dice si el servidor está listo
     GET  api.php?a=cargar    → devuelve la base de datos
     POST api.php?a=guardar   → recibe la base de datos y la guarda
   ===================================================================== */

declare(strict_types=1);

/* ---------- ajustes ---------- */
const ARCHIVO   = __DIR__ . '/truequea-datos.json';   // se crea solo
const RESPALDOS = __DIR__ . '/respaldos';             // copias automáticas
const MAX_BYTES = 12 * 1024 * 1024;                   // 12 MB como máximo
const CLAVE_ADMIN = '';                               // opcional: pon una clave
                                                      // y agrégala en app.js

/* ---------- cabeceras ---------- */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function responder(array $datos, int $codigo = 200): void {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* ---------- utilidades ---------- */
function leerArchivo(): ?array {
    if (!is_file(ARCHIVO)) return null;
    $txt = @file_get_contents(ARCHIVO);
    if ($txt === false || $txt === '') return null;
    $datos = json_decode($txt, true);
    return is_array($datos) ? $datos : null;
}

/* Escribe de forma segura: primero a un temporal y luego reemplaza,
   así nunca queda un archivo a medias si se corta la luz. */
function escribirArchivo(array $datos): bool {
    $txt = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($txt === false) return false;
    $tmp = ARCHIVO . '.tmp';
    if (@file_put_contents($tmp, $txt, LOCK_EX) === false) return false;
    return @rename($tmp, ARCHIVO);
}

/* Una copia por día, por si alguien borra algo sin querer */
function respaldar(): void {
    if (!is_file(ARCHIVO)) return;
    if (!is_dir(RESPALDOS) && !@mkdir(RESPALDOS, 0775, true)) return;
    $destino = RESPALDOS . '/datos-' . date('Y-m-d') . '.json';
    if (!is_file($destino)) @copy(ARCHIVO, $destino);
}

function claveValida(): bool {
    if (CLAVE_ADMIN === '') return true;
    $enviada = $_SERVER['HTTP_X_TRUEQUEA_CLAVE'] ?? ($_GET['clave'] ?? '');
    return hash_equals(CLAVE_ADMIN, (string) $enviada);
}

/* ---------- rutas ---------- */
$accion = $_GET['a'] ?? 'estado';

if ($accion === 'estado') {
    responder([
        'ok'        => true,
        'servidor'  => 'Truequea PE',
        'php'       => PHP_VERSION,
        'guardado'  => is_file(ARCHIVO),
        'escribible' => is_writable(__DIR__) || (is_file(ARCHIVO) && is_writable(ARCHIVO)),
        'version'   => 7,
        'fecha'     => date('c'),
    ]);
}

if ($accion === 'cargar') {
    if (!claveValida()) responder(['ok' => false, 'error' => 'Clave inválida'], 403);
    $datos = leerArchivo();
    responder([
        'ok'          => true,
        'hay'         => $datos !== null,
        'datos'       => $datos,
        'actualizado' => is_file(ARCHIVO) ? date('c', (int) filemtime(ARCHIVO)) : null,
    ]);
}

if ($accion === 'guardar') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        responder(['ok' => false, 'error' => 'Usa POST para guardar'], 405);
    }
    if (!claveValida()) responder(['ok' => false, 'error' => 'Clave inválida'], 403);

    $crudo = file_get_contents('php://input');
    if ($crudo === false || $crudo === '') {
        responder(['ok' => false, 'error' => 'No llegó nada'], 400);
    }
    if (strlen($crudo) > MAX_BYTES) {
        responder(['ok' => false, 'error' => 'Los datos pesan demasiado (máx. 12 MB)'], 413);
    }

    $datos = json_decode($crudo, true);
    if (!is_array($datos) || !isset($datos['usuarios']) || !is_array($datos['usuarios'])) {
        responder(['ok' => false, 'error' => 'El formato no es válido'], 400);
    }

    respaldar();
    if (!escribirArchivo($datos)) {
        responder(['ok' => false,
                   'error' => 'No se pudo escribir. Dale permisos de escritura a la carpeta.'], 500);
    }
    responder(['ok' => true, 'guardado' => date('c'),
               'usuarios' => count($datos['usuarios']),
               'articulos' => isset($datos['articulos']) ? count($datos['articulos']) : 0]);
}

if ($accion === 'reiniciar') {
    if (!claveValida()) responder(['ok' => false, 'error' => 'Clave inválida'], 403);
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        responder(['ok' => false, 'error' => 'Usa POST'], 405);
    }
    respaldar();
    if (is_file(ARCHIVO)) @unlink(ARCHIVO);
    responder(['ok' => true, 'mensaje' => 'Base de datos vaciada. Se guardó un respaldo.']);
}

responder(['ok' => false, 'error' => 'Acción desconocida'], 404);
