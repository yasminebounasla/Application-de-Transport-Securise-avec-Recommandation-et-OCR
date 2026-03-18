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

@scheduler.scheduled_job(CronTrigger(day_of_week='Wed', hour=12, minute=26))
async def retrain_weekly():
    logger.info("🔄 Réentraînement hebdomadaire démarré...")
    try:
        retrain_path = os.path.join(os.path.dirname(__file__), "retrain.py")
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
        if proc.returncode == 0:
            logger.info("✅ Réentraînement terminé avec succès")
            logger.debug(stdout.decode())
        else:
            logger.error(f"❌ Erreur retrain.py :\n{stderr.decode()}")
    except Exception as e:
        logger.error(f"❌ Erreur scheduler : {e}")

if __name__ == "__main__":
    scheduler.start()
    logger.info("✅ Scheduler en marche — prochain run: lundi 02:00")
    try:
        asyncio.get_event_loop().run_forever()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("🛑 Scheduler arrêté")