# Generated by Django 5.0.8 on 2024-09-13 14:34

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zerver", "0590_alter_realm_can_create_groups"),
    ]

    operations = [
        migrations.AddField(
            model_name="realm",
            name="can_manage_all_groups",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="+",
                to="zerver.usergroup",
            ),
        )
    ]
