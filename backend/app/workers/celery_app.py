from celery import Celery
from ..config import settings


celery = Celery(
    "subsidy",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=["app.workers.tasks"],
)

celery.conf.task_acks_late = True
celery.conf.task_reject_on_worker_lost = True
celery.conf.task_default_retry_delay = 60
celery.conf.worker_prefetch_multiplier = 1
celery.conf.broker_connection_retry_on_startup = True
