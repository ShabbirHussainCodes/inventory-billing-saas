from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os

class Command(BaseCommand):
    def handle(self, *args, **options):
        User = get_user_model()
        email = 'shabbirtech110@gmail.com'
        password = os.getenv('SUPER_ADMIN_PASSWORD', 'Admin@12345')
        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(
                email=email,
                password=password,
                first_name='Shabbir',
                last_name='Hussain'
            )
            self.stdout.write('Superuser created ✅')
        else:
            self.stdout.write('Superuser already exists ✅')