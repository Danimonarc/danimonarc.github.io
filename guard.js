// Anti-clickjacking: GitHub Pages no deja enviar frame-ancestors por cabecera, así que si la página
// está dentro de un marco se sale de él (o se oculta). Lo cargan /g/, /t/ y /j/.
if (self !== top) { try { top.location = self.location; } catch (e) { document.documentElement.style.display = "none"; } }
