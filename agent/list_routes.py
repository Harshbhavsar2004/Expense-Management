from main import app
from fastapi.routing import APIRoute, Mount

def print_routes(routes, prefix=""):
    for route in routes:
        if isinstance(route, APIRoute):
            print(f"Path: {prefix}{route.path}, Name: {route.name}")
        elif isinstance(route, Mount):
            print_routes(route.app.routes, prefix=prefix + route.path)

print_routes(app.routes)
