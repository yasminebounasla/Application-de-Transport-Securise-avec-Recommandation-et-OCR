import asyncio
import sys
import os
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# @scheduler.scheduled_job(CronTrigger(day_of_week='Thu', hour=17, minute=36))
# async def retrain_weekly():
#     logger.info("🔄 Réentraînement hebdomadaire démarré...")
#     try:
#         retrain_path = os.path.join(os.path.dirname(__file__), "retrain.py")
#         proc = await asyncio.create_subprocess_exec(
#             "docker", "run", "--rm",
#             "-v", f"{os.path.dirname(os.path.dirname(os.path.abspath(__file__)))}:/app",
#             "lightfm-retrain",
#             "bash", "-c",
#             "cd /app && python service/retrain.py",
#             stdout=asyncio.subprocess.PIPE,
#             stderr=asyncio.subprocess.PIPE
#         )
#         stdout, stderr = await proc.communicate()
#         stdout_decoded = stdout.decode()
#         stderr_decoded = stderr.decode()

#         logger.info(f"🔹 retrain stdout:\n{stdout_decoded}")
#         if proc.returncode == 0:
#             logger.info("✅ Réentraînement terminé avec succès")
#         else:
#             logger.error(f"❌ Erreur retrain.py :\n{stderr_decoded}")
#     except Exception as e:
#         logger.error(f"❌ Erreur scheduler : {e}")

@scheduler.scheduled_job(CronTrigger(day_of_week='Fri', hour=16, minute=37))
async def retrain_weekly():
    logger.info("🔄 Réentraînement hebdomadaire démarré...")

    MAX_RETRIES = 2
    for attempt in range(MAX_RETRIES):
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "run", "--rm",
                "-v", f"{os.path.dirname(os.path.dirname(os.path.abspath(__file__)))}:/app",
                "lightfm-retrain",
                "bash", "-c",
                "cd /app && python service/retrain.py",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            stdout_decoded = stdout.decode()
            stderr_decoded = stderr.decode()

            logger.info(f"🔹 retrain stdout (tentative {attempt+1}):\n{stdout_decoded}")

            if proc.returncode == 0:
                logger.info("✅ Réentraînement terminé avec succès")
                break
            else:
                logger.warning(f"⚠️ Tentative {attempt+1} échouée : {stderr_decoded}")

        except Exception as e:
            logger.error(f"❌ Erreur scheduler tentative {attempt+1} : {e}")

    else:
        logger.error("❌ Réentraînement échoué après plusieurs tentatives")

if __name__ == "__main__":
    scheduler.start()
    logger.info("✅ Scheduler en marche ")
    try:
        asyncio.get_event_loop().run_forever()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("🛑 Scheduler arrêté")