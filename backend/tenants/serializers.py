from rest_framework import serializers
from .models import Tenant


class TenantSettingsSerializer(serializers.ModelSerializer):
    """
    Business owner apne business ke contact details edit kar sakta hai —
    yeh invoice header pe dikhte hain (company name, GST, phone, email, etc).
    Core fields (name, currency, access_type) yahan se edit nahi hote —
    woh founder-controlled hain.
    """
    class Meta:
        model = Tenant
        fields = [
            'name',
            'gst_number',
            'business_phone',
            'business_email',
            'business_address',
            'business_website',
            'currency',
            'tax_label',
        ]
        read_only_fields = ['currency', 'tax_label']  # Founder hi badal sakta hai