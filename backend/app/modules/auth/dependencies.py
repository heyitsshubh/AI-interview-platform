"""
Auth module dependency injection helpers.
"""
from app.modules.auth.service import AuthService
from app.modules.auth.controller import AuthController


def get_auth_service() -> AuthService:
    return AuthService()


def get_auth_controller() -> AuthController:
    return AuthController()
