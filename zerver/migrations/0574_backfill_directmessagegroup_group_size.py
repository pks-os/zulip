# Generated by Django 5.0.6 on 2024-08-16 06:44

from django.db import migrations, transaction
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import Count, Model, OuterRef, Subquery

BATCH_SIZE = 1000


def backfill_group_size_field_for_direct_message_groups(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    DirectMessageGroup = apps.get_model("zerver", "DirectMessageGroup")
    Recipient = apps.get_model("zerver", "Recipient")
    Subscription = apps.get_model("zerver", "Subscription")

    RECIPIENT_DIRECT_MESSAGE_GROUP = 3

    direct_message_group_recipient_entries = Recipient.objects.filter(
        type=RECIPIENT_DIRECT_MESSAGE_GROUP
    )

    if not direct_message_group_recipient_entries.exists():
        return

    recipient_id_lower_bound = direct_message_group_recipient_entries.earliest("id").id
    max_recipient_id = Recipient.objects.latest("id").id

    # We would like to set the upper bound significantly past the
    # maximum recipient id, because it is likely that new Direct
    # Message Groups are created during this transaction, and their
    # recipient id is assigned as the one right after the max id.
    max_recipient_id += BATCH_SIZE

    while recipient_id_lower_bound <= max_recipient_id:
        do_backfill_group_size_field_for_direct_message_groups(
            Subscription,
            DirectMessageGroup,
            recipient_id_lower_bound,
            min(recipient_id_lower_bound + BATCH_SIZE, max_recipient_id),
        )
        recipient_id_lower_bound += BATCH_SIZE + 1


@transaction.atomic
def do_backfill_group_size_field_for_direct_message_groups(
    subscription_model: type[Model],
    direct_message_group_model: type[Model],
    recipient_id_lower_bound: int,
    recipient_id_upper_bound: int,
) -> None:
    direct_message_group_sub_size = (
        subscription_model._default_manager.filter(recipient=OuterRef("recipient"))
        .values("recipient")
        .annotate(count=Count("id"))
        .values("count")[:1]
    )

    direct_message_group_model._default_manager.filter(
        recipient__id__range=(recipient_id_lower_bound, recipient_id_upper_bound), group_size=None
    ).update(group_size=Subquery(direct_message_group_sub_size))


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("zerver", "0573_directmessagegroup_group_size"),
    ]

    operations = [
        migrations.RunPython(
            backfill_group_size_field_for_direct_message_groups,
            elidable=True,
            reverse_code=migrations.RunPython.noop,
        ),
    ]