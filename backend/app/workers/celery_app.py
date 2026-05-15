from ..config import settings

if settings.inline_tasks:
    class _FakeCelery:
        """Stub when running in inline mode (no Redis/Celery)."""
        conf = type("Conf", (), {
            "task_acks_late": True,
            "task_reject_on_worker_lost": True,
            "task_default_retry_delay": 60,
            "worker_prefetch_multiplier": 1,
            "broker_connection_retry_on_startup": True,
        })()

        def task(self, *args, **kwargs):
            def decorator(fn):
                fn.delay = fn
                fn.apply_async = lambda *a, **kw: fn(*a)
                return fn
            return decorator

        def send_task(self, name, args=None, kwargs=None, **opts):
            pass

    celery = _FakeCelery()
else:
    from celery import Celery
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
