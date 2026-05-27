"""Mount the React build into FastAPI as static files, with SPA fallback."""
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'frontend_build')
)


class SPAStaticFiles(StaticFiles):
    """Serve static files, fallback to index.html for client-side routes."""
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except Exception:
            return FileResponse(os.path.join(self.directory, 'index.html'))


def mount_frontend(app):
    if os.path.isdir(FRONTEND_DIR):
        app.mount("/", SPAStaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
        return True
    return False
