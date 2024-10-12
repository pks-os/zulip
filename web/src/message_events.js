import $ from "jquery";
import _ from "lodash";
import assert from "minimalistic-assert";

import * as alert_words from "./alert_words";
import * as channel from "./channel";
import * as compose_fade from "./compose_fade";
import * as compose_notifications from "./compose_notifications";
import * as compose_recipient from "./compose_recipient";
import * as compose_state from "./compose_state";
import * as compose_validate from "./compose_validate";
import * as direct_message_group_data from "./direct_message_group_data";
import * as drafts from "./drafts";
import * as echo from "./echo";
import * as message_edit from "./message_edit";
import * as message_edit_history from "./message_edit_history";
import * as message_events_util from "./message_events_util";
import * as message_helper from "./message_helper";
import * as message_list_data_cache from "./message_list_data_cache";
import * as message_lists from "./message_lists";
import * as message_notifications from "./message_notifications";
import * as message_parser from "./message_parser";
import * as message_store from "./message_store";
import * as message_util from "./message_util";
import * as message_view from "./message_view";
import * as narrow_state from "./narrow_state";
import * as pm_list from "./pm_list";
import * as recent_senders from "./recent_senders";
import * as recent_view_ui from "./recent_view_ui";
import * as recent_view_util from "./recent_view_util";
import * as starred_messages from "./starred_messages";
import * as starred_messages_ui from "./starred_messages_ui";
import {realm} from "./state_data";
import * as stream_list from "./stream_list";
import * as stream_topic_history from "./stream_topic_history";
import * as sub_store from "./sub_store";
import * as unread from "./unread";
import * as unread_ops from "./unread_ops";
import * as unread_ui from "./unread_ui";
import * as util from "./util";

export function update_views_filtered_on_message_property(
    message_ids,
    property_term_type,
    property_value,
) {
    // NOTE: Call this function after updating the message property locally.
    assert(!property_term_type.includes("not-"));

    // List of narrow terms whose msg list doesn't get updated elsewhere but
    // can be applied locally.
    const supported_term_types = [
        "has-image",
        "has-link",
        "has-reaction",
        "has-attachment",
        "is-starred",
        "is-unread",
        "is-mentioned",
        "is-alerted",
        // TODO: Implement support for these terms.
        // "is-followed",
    ];

    if (message_ids.length === 0 || !supported_term_types.includes(property_term_type)) {
        return;
    }

    for (const msg_list of message_lists.all_rendered_message_lists()) {
        const filter = msg_list.data.filter;
        const filter_term_types = filter.sorted_term_types();
        if (
            // Check if current filter relies on the changed message property.
            !filter_term_types.includes(property_term_type) &&
            !filter_term_types.includes(`not-${property_term_type}`)
        ) {
            continue;
        }

        // We need the message objects to determine if they match the filter.
        const messages_to_fetch = [];
        const messages = [];
        for (const message_id of message_ids) {
            const message = message_store.get(message_id);
            if (message !== undefined) {
                messages.push(message);
            } else {
                if (
                    (filter_term_types.includes(property_term_type) && !property_value) ||
                    (filter_term_types.includes(`not-${property_term_type}`) && property_value)
                ) {
                    // If the message is not cached, that means it is not present in the message list.
                    // Also, the message is not supposed to be in the message list as per the filter and
                    // it's property value. So, we don't need to fetch the message.
                    continue;
                }

                const first_id = msg_list.first().id;
                const last_id = msg_list.last().id;
                const has_found_newest = msg_list.data.fetch_status.has_found_newest();
                const has_found_oldest = msg_list.data.fetch_status.has_found_oldest();

                if (message_id > first_id && message_id < last_id) {
                    // Need to insert message middle of the list.
                    messages_to_fetch.push(message_id);
                } else if (message_id < first_id && has_found_oldest) {
                    // Need to insert message at the start of list.
                    messages_to_fetch.push(message_id);
                } else if (message_id > last_id && has_found_newest) {
                    // Need to insert message at the end of list.
                    messages_to_fetch.push(message_id);
                }
            }
        }

        if (!filter.can_apply_locally()) {
            channel.get({
                url: "/json/messages",
                data: {
                    message_ids: JSON.stringify(message_ids),
                    narrow: JSON.stringify(filter.terms()),
                },
                success(data) {
                    const messages_to_add = [];
                    const messages_to_remove = new Set(message_ids);
                    for (const raw_message of data.messages) {
                        messages_to_remove.delete(raw_message.id);
                        let message = message_store.get(raw_message.id);
                        if (!message) {
                            message = message_helper.process_new_message(raw_message);
                        }
                        messages_to_add.push(message);
                    }
                    msg_list.data.remove([...messages_to_remove]);
                    msg_list.data.add_messages(messages_to_add);
                    msg_list.rerender();
                },
            });
        } else if (messages_to_fetch.length > 0) {
            // Fetch the message and update the view.
            channel.get({
                url: "/json/messages",
                data: {
                    message_ids: JSON.stringify(messages_to_fetch),
                    // We don't filter by narrow here since we can
                    // apply the filter locally and the fetched message
                    // can be used to update other message lists and
                    // cached message data structures as well.
                },
                success(data) {
                    // `messages_to_fetch` might already be cached locally when
                    // we reach here but `message_helper.process_new_message`
                    // already handles that case.
                    for (const raw_message of data.messages) {
                        message_helper.process_new_message(raw_message);
                    }
                    update_views_filtered_on_message_property(
                        message_ids,
                        property_term_type,
                        property_value,
                    );
                },
            });
        } else {
            // We have all the messages locally, so we can update the view.
            //
            // Special case: For starred messages view, we don't remove
            // messages that are no longer starred to avoid
            // implementing an undo mechanism for that view.
            // TODO: A cleaner way to implement this might be to track which things
            // have been unstarred in the starred messages view in this visit
            // to the view, and have those stay.
            if (
                property_term_type === "is-starred" &&
                _.isEqual(filter.sorted_term_types(), ["is-starred"])
            ) {
                msg_list.add_messages(messages);
                continue;
            }

            // In most cases, we are only working to update a single message.
            if (messages.length === 1) {
                const message = messages[0];
                if (filter.predicate()(message)) {
                    msg_list.add_messages(messages);
                } else {
                    msg_list.remove_and_rerender(message_ids);
                }
            } else {
                msg_list.data.remove(message_ids);
                msg_list.data.add_messages(messages);
                msg_list.rerender();
            }
        }
    }
}

export function insert_new_messages(messages, sent_by_this_client, deliver_locally) {
    messages = messages.map((message) =>
        message_helper.process_new_message(message, deliver_locally),
    );

    const any_untracked_unread_messages = unread.process_loaded_messages(messages, false);
    direct_message_group_data.process_loaded_messages(messages);

    let need_user_to_scroll = false;
    for (const list of message_lists.all_rendered_message_lists()) {
        if (!list.data.filter.can_apply_locally()) {
            // If we cannot locally calculate whether the new messages
            // match the message list, we ask the server whether the
            // new messages match the narrow, and use that to
            // determine which new messages to add to the current
            // message list (or display a notification).

            if (deliver_locally) {
                // However, this is a local echo attempt, we can't ask
                // the server about the match, since we don't have a
                // final message ID. In that situation, we do nothing
                // and echo.process_from_server will call
                // message_events_util.maybe_add_narrowed_messages
                // once the message is fully delivered.
                continue;
            }

            message_events_util.maybe_add_narrowed_messages(
                messages,
                list,
                message_util.add_new_messages,
            );
            continue;
        }

        // Update the message list's rendering for the newly arrived messages.
        const render_info = message_util.add_new_messages(messages, list);

        // The render_info.need_user_to_scroll calculation, which
        // looks at message feed scroll positions to see whether the
        // newly arrived message will be visible, is only valid if
        // this message list is the currently visible message list.
        const is_currently_visible =
            narrow_state.is_message_feed_visible() && list === message_lists.current;
        if (is_currently_visible && render_info && render_info.need_user_to_scroll) {
            need_user_to_scroll = true;
        }
    }

    for (const msg_list_data of message_lists.non_rendered_data()) {
        if (!msg_list_data.filter.can_apply_locally()) {
            message_list_data_cache.remove(msg_list_data.filter);
        } else {
            message_util.add_new_messages_data(messages, msg_list_data);
        }
    }

    // sent_by_this_client will be true if ANY of the messages
    // were sent by this client; notifications.notify_local_mixes
    // will filter out any not sent by us.
    if (sent_by_this_client) {
        compose_notifications.notify_local_mixes(messages, need_user_to_scroll, {
            narrow_to_recipient(message_id) {
                message_view.narrow_by_topic(message_id, {trigger: "outside_current_view"});
            },
        });
    }

    if (any_untracked_unread_messages) {
        unread_ui.update_unread_counts();
    }

    // Messages being locally echoed need must be inserted into this
    // tracking before we update the stream sidebar, to take advantage
    // of how stream_topic_history uses the echo data structures.
    if (deliver_locally) {
        messages.map((message) => echo.track_local_message(message));
    }

    unread_ops.process_visible();
    message_notifications.received_messages(messages);
    stream_list.update_streams_sidebar();
    pm_list.update_private_messages();

    return messages;
}

export function update_messages(events) {
    const messages_to_rerender = [];
    let changed_narrow = false;
    let refreshed_current_narrow = false;
    let changed_compose = false;
    let any_message_content_edited = false;
    let local_cache_missing_messages = false;

    // Clear message list data cache since the local data for the
    // filters might no longer be accurate.
    //
    // TODO: Add logic to update the message list data cache.
    // Special care needs to be taken to ensure that the cache is
    // updated correctly when the message is moved to a different
    // stream or topic. Also, we need to update message lists like
    // `is:starred`, `is:mentioned`, etc. when the message flags are
    // updated.
    message_list_data_cache.clear();

    for (const event of events) {
        const anchor_message = message_store.get(event.message_id);
        if (anchor_message !== undefined) {
            // Logic for updating the specific edited message only
            // needs to run if we had a local copy of the message.

            delete anchor_message.local_edit_timestamp;

            message_store.update_booleans(anchor_message, event.flags);

            if (event.rendered_content !== undefined) {
                anchor_message.content = event.rendered_content;
            }

            if (event.is_me_message !== undefined) {
                anchor_message.is_me_message = event.is_me_message;
            }

            // mark the current message edit attempt as complete.
            message_edit.end_message_edit(event.message_id);

            // Save the content edit to the front end anchor_message.edit_history
            // before topic edits to ensure that combined topic / content
            // edits have edit_history logged for both before any
            // potential narrowing as part of the topic edit loop.
            if (event.orig_content !== undefined) {
                if (realm.realm_allow_edit_history) {
                    // Note that we do this for topic edits separately, below.
                    // If an event changed both content and topic, we'll generate
                    // two client-side events, which is probably good for display.
                    const edit_history_entry = {
                        user_id: event.user_id,
                        prev_content: event.orig_content,
                        prev_rendered_content: event.orig_rendered_content,
                        timestamp: event.edit_timestamp,
                    };
                    // Add message's edit_history in message dict
                    // For messages that are edited, edit_history needs to
                    // be added to message in frontend.
                    if (anchor_message.edit_history === undefined) {
                        anchor_message.edit_history = [];
                    }
                    anchor_message.edit_history = [
                        edit_history_entry,
                        ...anchor_message.edit_history,
                    ];
                }
                any_message_content_edited = true;

                // Update raw_content, so that editing a few times in a row is fast.
                anchor_message.raw_content = event.content;
            }

            if (unread.update_message_for_mention(anchor_message, any_message_content_edited)) {
                const topic_key = recent_view_util.get_topic_key(
                    anchor_message.stream_id,
                    anchor_message.topic,
                );
                recent_view_ui.inplace_rerender(topic_key);
            }
        }

        // new_topic will be undefined if the topic is unchanged.
        const new_topic = util.get_edit_event_topic(event);
        // new_stream_id will be undefined if the stream is unchanged.
        const new_stream_id = event.new_stream_id;
        // old_stream_id will be present and valid for all stream messages.
        const old_stream_id = event.stream_id;
        // old_stream will be undefined if the message was moved from
        // a stream that the current user doesn't have access to.
        const old_stream = sub_store.get(event.stream_id);

        // A topic or stream edit may affect multiple messages, listed in
        // event.message_ids. event.message_id is still the first message
        // where the user initiated the edit.
        const topic_edited = new_topic !== undefined;
        const stream_changed = new_stream_id !== undefined;
        const stream_archived = old_stream === undefined;

        if (!topic_edited && !stream_changed) {
            // If the topic or stream of the message was changed,
            // it will be rerendered if present in any rendered list.
            messages_to_rerender.push(anchor_message);
        } else {
            const going_forward_change = ["change_later", "change_all"].includes(
                event.propagate_mode,
            );

            const compose_stream_id = compose_state.stream_id();
            const orig_topic = util.get_edit_event_orig_topic(event);

            const current_filter = narrow_state.filter();
            const current_selected_id = message_lists.current?.selected_id();
            const selection_changed_topic =
                message_lists.current !== undefined &&
                event.message_ids.includes(current_selected_id);
            const event_messages = [];
            for (const message_id of event.message_ids) {
                // We don't need to concern ourselves updating data structures
                // for messages we don't have stored locally.
                const message = message_store.get(message_id);
                if (message !== undefined) {
                    event_messages.push(message);
                } else {
                    // If we don't have the message locally, we need to
                    // refresh the current narrow after the update to fetch
                    // the updated messages.
                    local_cache_missing_messages = true;
                }
            }
            // The event.message_ids received from the server are not in sorted order.
            // Sorts in ascending order.
            event_messages.sort((a, b) => a.id - b.id);

            if (
                going_forward_change &&
                !stream_archived &&
                compose_stream_id &&
                old_stream.stream_id === compose_stream_id &&
                orig_topic === compose_state.topic()
            ) {
                changed_compose = true;
                compose_state.topic(new_topic);

                if (stream_changed) {
                    compose_state.set_stream_id(new_stream_id);
                    compose_recipient.on_compose_select_recipient_update();
                }

                compose_validate.warn_if_topic_resolved(true);
                compose_fade.set_focused_recipient("stream");
            }

            if (going_forward_change) {
                drafts.rename_stream_recipient(old_stream_id, orig_topic, new_stream_id, new_topic);
            }

            // Remove the stream_topic_entry for the old topics;
            // must be called before we call set message topic.
            const num_messages = event_messages.length;
            if (num_messages > 0) {
                stream_topic_history.remove_messages({
                    stream_id: old_stream_id,
                    topic_name: orig_topic,
                    num_messages,
                    max_removed_msg_id: event_messages[num_messages - 1].id,
                });
            }

            for (const moved_message of event_messages) {
                if (realm.realm_allow_edit_history) {
                    /* Simulate the format of server-generated edit
                     * history events. This logic ensures that all
                     * messages that were moved are displayed as such
                     * without a browser reload. */
                    const edit_history_entry = {
                        user_id: event.user_id,
                        timestamp: event.edit_timestamp,
                    };
                    if (stream_changed) {
                        edit_history_entry.stream = new_stream_id;
                        edit_history_entry.prev_stream = old_stream_id;
                    }
                    if (topic_edited) {
                        edit_history_entry.topic = new_topic;
                        edit_history_entry.prev_topic = orig_topic;
                    }
                    if (moved_message.edit_history === undefined) {
                        moved_message.edit_history = [];
                    }
                    moved_message.edit_history = [
                        edit_history_entry,
                        ...moved_message.edit_history,
                    ];
                }
                moved_message.last_edit_timestamp = event.edit_timestamp;

                // Update the unread counts; again, this must be called
                // before we modify the topic field on the message.
                unread.update_unread_topics(moved_message, event);

                // Now edit the attributes of our message object.
                if (topic_edited) {
                    moved_message.topic = new_topic;
                    moved_message.topic_links = event.topic_links;
                }
                if (stream_changed) {
                    const new_stream_name = sub_store.get(new_stream_id).name;
                    moved_message.stream_id = new_stream_id;
                    moved_message.display_recipient = new_stream_name;
                }

                // Add the Recent Conversations entry for the new stream/topics.
                stream_topic_history.add_message({
                    stream_id: moved_message.stream_id,
                    topic_name: moved_message.topic,
                    message_id: moved_message.id,
                });
            }

            if (
                going_forward_change &&
                // This logic is a bit awkward.  What we're trying to
                // accomplish is two things:
                //
                // * If we're currently narrowed to a topic that was just moved,
                //   renarrow to the new location.
                // * We determine whether enough of the topic was moved to justify
                //   renarrowing by checking if the currently selected message is moved.
                //
                // Corner cases around only moving some messages in a topic
                // need to be thought about carefully when making changes.
                //
                // Code further down takes care of the actual rerendering of
                // messages within a narrow.
                selection_changed_topic &&
                current_filter &&
                old_stream_id &&
                current_filter.has_topic(old_stream_id, orig_topic)
            ) {
                let new_filter = current_filter;
                if (new_filter && stream_changed) {
                    // TODO: This logic doesn't handle the
                    // case where we're a guest user and the
                    // message moves to a stream we cannot
                    // access, which would cause the
                    // stream_data lookup here to fail.
                    //
                    // The fix is likely somewhat involved, so punting for now.
                    new_filter = new_filter.filter_with_new_params({
                        operator: "channel",
                        operand: new_stream_id.toString(),
                    });
                    changed_narrow = true;
                }

                if (new_filter && topic_edited) {
                    new_filter = new_filter.filter_with_new_params({
                        operator: "topic",
                        operand: new_topic,
                    });
                    changed_narrow = true;
                }
                // NOTE: We should always be changing narrows after we finish
                //       updating the local data and UI. This avoids conflict
                //       with data fetched from the server (which is already updated)
                //       when we move to new narrow and what data is locally available.
                if (changed_narrow) {
                    const terms = new_filter.terms();
                    const opts = {
                        trigger: "stream/topic change",
                        then_select_id: current_selected_id,
                    };
                    message_view.show(terms, opts);
                }
            }

            // If a message was moved to the current narrow and we don't have
            // the message cached, we need to refresh the narrow to display the message.
            if (!changed_narrow && local_cache_missing_messages && current_filter) {
                let moved_message_stream_id_str = old_stream_id.toString();
                let moved_message_topic = orig_topic;
                if (stream_changed) {
                    moved_message_stream_id_str = sub_store.get(new_stream_id).stream_id.toString();
                }

                if (topic_edited) {
                    moved_message_topic = new_topic;
                }

                if (
                    current_filter.can_newly_match_moved_messages(
                        moved_message_stream_id_str,
                        moved_message_topic,
                    )
                ) {
                    refreshed_current_narrow = true;
                    message_view.show(current_filter.terms(), {
                        then_select_id: current_selected_id,
                        trigger: "stream/topic change",
                        force_rerender: true,
                    });
                }
            }

            // Ensure messages that are no longer part of this
            // narrow are deleted and messages that are now part
            // of this narrow are added to the message_list.
            //
            // TODO: Update cached message list data objects as well.
            for (const list of message_lists.all_rendered_message_lists()) {
                if (
                    list === message_lists.current &&
                    (changed_narrow || refreshed_current_narrow)
                ) {
                    continue;
                }

                if (list.data.filter.can_apply_locally()) {
                    const predicate = list.data.filter.predicate();
                    let message_ids_to_remove = event_messages.filter((msg) => !predicate(msg));
                    message_ids_to_remove = message_ids_to_remove.map((msg) => msg.id);
                    // We filter out messages that do not belong to the message
                    // list and then pass these to the remove messages codepath.
                    // While we can pass all our messages to the add messages
                    // codepath as the filtering is done within the method.
                    list.remove_and_rerender(message_ids_to_remove);
                    list.add_messages(event_messages);
                } else {
                    // Remove existing message that were updated, since
                    // they may not be a part of the filter now. Also,
                    // this will help us rerender them via
                    // maybe_add_narrowed_messages, if they were
                    // simply updated.
                    const updated_messages = event_messages.filter(
                        (msg) => list.data.get(msg.id) !== undefined,
                    );
                    list.remove_and_rerender(updated_messages.map((msg) => msg.id));
                    // For filters that cannot be processed locally, ask server.
                    message_events_util.maybe_add_narrowed_messages(
                        event_messages,
                        list,
                        message_util.add_messages,
                    );
                }
            }
        }

        if (anchor_message !== undefined) {
            // Mark the message as edited for the UI. The rendering_only
            // flag is used to indicated update_message events that are
            // triggered by server latency optimizations, not user
            // interactions; these should not generate edit history updates.
            if (!event.rendering_only) {
                anchor_message.last_edit_timestamp = event.edit_timestamp;
            }

            message_notifications.received_messages([anchor_message]);
            alert_words.process_message(anchor_message);
        }

        if (topic_edited || stream_changed) {
            // if topic is changed
            let pre_edit_topic = util.get_edit_event_orig_topic(event);
            let post_edit_topic = new_topic;

            if (!topic_edited) {
                if (anchor_message !== undefined) {
                    pre_edit_topic = anchor_message.topic;
                }
                post_edit_topic = pre_edit_topic;
            }

            // new_stream_id is undefined if this is only a topic edit.
            const post_edit_stream_id = new_stream_id || old_stream_id;

            const args = [old_stream_id, pre_edit_topic, post_edit_topic, post_edit_stream_id];
            recent_senders.process_topic_edit({
                message_ids: event.message_ids,
                old_stream_id,
                old_topic: pre_edit_topic,
                new_stream_id: post_edit_stream_id,
                new_topic: post_edit_topic,
            });
            unread.clear_and_populate_unread_mention_topics();
            recent_view_ui.process_topic_edit(...args);
        }

        // Rerender "Message edit history" if it was open to the edited message.
        if (
            anchor_message !== undefined &&
            $("#message-edit-history").parents(".micromodal").hasClass("modal--open") &&
            anchor_message.id === Number.parseInt($("#message-history").attr("data-message-id"), 10)
        ) {
            message_edit_history.fetch_and_render_message_history(anchor_message);
        }

        if (event.rendered_content !== undefined) {
            // It is fine to call this in a loop since most of the time we are
            // only working with a single message content edit.
            update_views_filtered_on_message_property(
                [event.message_id],
                "has-image",
                message_parser.message_has_image(event.rendered_content),
            );
            update_views_filtered_on_message_property(
                [event.message_id],
                "has-link",
                message_parser.message_has_link(event.rendered_content),
            );
            update_views_filtered_on_message_property(
                [event.message_id],
                "has-attachment",
                message_parser.message_has_attachment(event.rendered_content),
            );

            const is_mentioned = event.flags.some((flag) =>
                ["mentioned", "stream_wildcard_mentioned", "topic_wildcard_mentioned"].includes(
                    flag,
                ),
            );
            update_views_filtered_on_message_property(
                [event.message_id],
                "is-mentioned",
                is_mentioned,
            );
            const is_alerted = event.flags.includes("has_alert_word");
            update_views_filtered_on_message_property([event.message_id], "is-alerted", is_alerted);
        }
    }

    if (messages_to_rerender.length > 0) {
        // If the content of the message was edited, we do a special animation.
        //
        // BUG: This triggers the "message edited" animation for every
        // message that was edited if any one of them had its content
        // edited. We should replace any_message_content_edited with
        // passing two sets to rerender_messages; the set of all that
        // are changed, and the set with content changes.
        for (const list of message_lists.all_rendered_message_lists()) {
            list.view.rerender_messages(messages_to_rerender, any_message_content_edited);
        }
    }

    if (changed_compose) {
        // We need to do this after we rerender the message list, to
        // produce correct results.
        compose_fade.update_message_list();
    }

    unread_ui.update_unread_counts();
    stream_list.update_streams_sidebar();
    pm_list.update_private_messages();
}

export function remove_messages(message_ids) {
    // Update the rendered data first since it is most user visible.
    for (const list of message_lists.all_rendered_message_lists()) {
        list.remove_and_rerender(message_ids);
    }

    for (const msg_list_data of message_lists.non_rendered_data()) {
        msg_list_data.remove(message_ids);
    }

    recent_senders.update_topics_of_deleted_message_ids(message_ids);
    recent_view_ui.update_topics_of_deleted_message_ids(message_ids);
    starred_messages.remove(message_ids);
    starred_messages_ui.rerender_ui();
    message_store.remove(message_ids);
}
