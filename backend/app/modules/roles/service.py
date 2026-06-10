"""
Role service: seeds roles/permissions and manages assignments.
"""
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

ROLE_PERMISSIONS = {
    "CANDIDATE": [
        ("upload:resume", "Upload a resume document"),
        ("attend:interview", "Attend and participate in interviews"),
        ("view:own_report", "View own interview report"),
        ("submit:cheating_event", "Submit cheating detection events"),
    ],
    "RECRUITER": [
        ("create:interview", "Create and manage interviews"),
        ("view:all_reports", "View all interview reports"),
        ("view:cheating_report", "View cheating detection reports"),
        ("list:candidates", "List all candidate users"),
    ],
}


class RoleService:
    async def seed_roles_and_permissions(self, db: AsyncSession) -> None:
        """Seed CANDIDATE and RECRUITER roles with their permissions."""
        from app.modules.roles.model import Role, Permission, RolePermission

        for role_name, permissions in ROLE_PERMISSIONS.items():
            # Get or create role
            result = await db.execute(select(Role).where(Role.name == role_name))
            role = result.scalar_one_or_none()
            if not role:
                role = Role(name=role_name)
                db.add(role)
                await db.flush()
                logger.info(f"Created role: {role_name}")

            # Get or create permissions and assign
            for perm_name, perm_desc in permissions:
                result = await db.execute(select(Permission).where(Permission.name == perm_name))
                perm = result.scalar_one_or_none()
                if not perm:
                    perm = Permission(name=perm_name, description=perm_desc)
                    db.add(perm)
                    await db.flush()

                # Link role to permission if not already linked
                link_result = await db.execute(
                    select(RolePermission)
                    .where(RolePermission.role_id == role.id)
                    .where(RolePermission.permission_id == perm.id)
                )
                if not link_result.scalar_one_or_none():
                    db.add(RolePermission(role_id=role.id, permission_id=perm.id))

        await db.flush()
        logger.info("Roles and permissions seeded successfully")
