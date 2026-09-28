from __future__ import annotations

import asyncio
import unittest

from app.config import DEFAULT_PORT, settings
from app.landing import render_landing_page
from app.main import app
from app.routers.health import health, ready


class SettingsTests(unittest.TestCase):
    def test_project_identity(self) -> None:
        self.assertEqual(settings.project_name, "{{PROJECT_NAME}}")
        self.assertEqual(settings.author, "{{AUTHOR_NAME}}")

    def test_default_port(self) -> None:
        self.assertEqual(DEFAULT_PORT, {{DEFAULT_PORT}})
        self.assertTrue(1 <= settings.port <= 65535)


class RouteTests(unittest.TestCase):
    def test_health_routes_are_registered(self) -> None:
        paths = {route.path for route in app.routes}
        self.assertIn("/api/health", paths)
        self.assertIn("/api/health/ready", paths)
        self.assertIn("/", paths)

    def test_health_payload(self) -> None:
        payload = asyncio.run(health())
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["project"], settings.project_name)

    def test_ready_payload(self) -> None:
        payload = asyncio.run(ready())
        self.assertEqual(payload["status"], "ready")


class LandingPageTests(unittest.TestCase):
    def test_page_mentions_the_project(self) -> None:
        html = render_landing_page()
        self.assertIn(settings.project_name, html)
        self.assertIn("<!DOCTYPE html>", html)


if __name__ == "__main__":
    unittest.main()
