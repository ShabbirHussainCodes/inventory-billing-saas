from rest_framework import serializers
from .models import CustomUser
from tenants.models import Tenant


class TenantRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['name', 'country', 'currency', 'tax_label', 'timezone']


class UserRegistrationSerializer(serializers.ModelSerializer):

    # Password field — screen pe nahi dikhega
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            'min_length': 'Password must be at least 8 characters long.'
        }
    )

    # Tenant info bhi lenge registration mein
    business_name = serializers.CharField(write_only=True)
    country = serializers.CharField(write_only=True, default='India')
    currency = serializers.CharField(write_only=True, default='INR')
    tax_label = serializers.CharField(write_only=True, default='GST')
    timezone = serializers.CharField(
        write_only=True,
        default='Asia/Kolkata'
    )

    class Meta:
        model = CustomUser
        fields = [
            'email',
            'password',
            'first_name',
            'last_name',
            'phone',
            'business_name',
            'country',
            'currency',
            'tax_label',
            'timezone',
        ]

    def create(self, validated_data):

        # Tenant ki info alag karo
        business_name = validated_data.pop('business_name')
        country = validated_data.pop('country')
        currency = validated_data.pop('currency')
        tax_label = validated_data.pop('tax_label')
        timezone = validated_data.pop('timezone')
        password = validated_data.pop('password')

        # Pehle Tenant banao
        tenant = Tenant.objects.create(
            name=business_name,
            subdomain=business_name.lower().replace(' ', '-'),
            country=country,
            currency=currency,
            tax_label=tax_label,
            timezone=timezone,
            access_type='free_tier'
        )

        # Phir User banao aur tenant se link karo
        user = CustomUser.objects.create_user(
            tenant=tenant,
            role='business_owner',
            **validated_data
        )
        user.set_password(password)
        user.save()

        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone',
            'role',
            'tenant',
            'created_at'
        ]
        read_only_fields = ['id', 'email', 'role', 'created_at']