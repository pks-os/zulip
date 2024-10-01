import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	base: 'help-beta',
	integrations: [
		starlight({
			title: 'Zulip help center',
			pagination: false,
			customCss: [
				'./src/styles/main.css'
			],
			sidebar: [
				{
					label: 'Zulip homepage',
					link: 'https://zulip.com'
				},
				{
					label: 'Help center home',
					slug: 'index'
				},
				{
					label: 'Guides',
					items: [
						'getting-started-with-zulip',
						'trying-out-zulip',
						'zulip-cloud-or-self-hosting',
						'moving-to-zulip',
						'moderating-open-organizations',
						'setting-up-zulip-for-a-class',
						'using-zulip-for-a-class',
						'using-zulip-via-email'
					]
				},
				{
					label: 'Getting started',
					items: [
						'join-a-zulip-organization',
						'set-up-your-account',
						'introduction-to-topics',
						{
							label: 'Starting a new topic',
							link: '/introduction-to-topics#how-to-start-a-new-topic'
						},
						'finding-a-conversation-to-read',
						'reading-conversations',
						'starting-a-new-direct-message',
						'replying-to-messages',
						'messaging-tips',
						'keyboard-shortcuts'
					]
				},
				{
					label: 'Setting up your organization',
					items: [
						'migrating-from-other-chat-tools',
						'create-your-organization-profile',
						'customize-organization-settings',
						'create-channels',
						'customize-settings-for-new-users',
						'invite-users-to-join',
						'create-user-groups',
						'set-up-integrations'
					]
				},
				{
					label: 'Account basics',
					items: [
						'edit-your-profile',
						'change-your-name',
						'change-your-email-address',
						'change-your-profile-picture',
						'change-your-password',
						'configure-email-visibility',
						'logging-in',
						'logging-out',
						'switching-between-organizations',
						'import-your-settings',
						'review-your-settings',
						'deactivate-your-account'
					]
				}, 
				{
					label: 'Preferences',
					items: [
						'dark-theme',
						'font-size',
						'change-your-language',
						'change-your-timezone',
						'change-the-time-format',
						'configure-emoticon-translations',
						'configure-home-view',
						'enable-full-width-display',
						'manage-your-uploaded-files'
					]
				},
				{
					label: 'Writing messages',
					items: [
						'format-your-message-using-markdown',
						'mention-a-user-or-group',
						'link-to-a-message-or-conversation',
						'format-a-quote',
						'quote-and-reply',
						'emoji-and-emoticons',
						'insert-a-link',
						'share-and-upload-files',
						'animated-gifs-from-giphy',
						'text-emphasis',
						'paragraph-and-section-formatting',
						'bulleted-lists',
						'numbered-lists',
						'tables',
						'code-blocks',
						'latex',
						'spoilers',
						'me-action-messages',
						'create-a-poll',
						'collaborative-to-do-lists',
						'global-times',
						'start-a-call'
					]
				},
				{
					label: 'Sending messages',
					items: [
						'open-the-compose-box',
						'mastering-the-compose-box',
						'resize-the-compose-box',
						'typing-notifications',
						'preview-your-message-before-sending',
						'verify-your-message-was-successfully-sent',
						'edit-a-message',
						'delete-a-message',
						'view-and-edit-your-message-drafts',
						'schedule-a-message',
						'message-a-channel-by-email'
					]
				},
				{
					label: 'Reading messages',
					items: [
						'reading-strategies',
						'inbox',
						'recent-conversations',
						'combined-feed',
						'channel-feed',
						'left-sidebar',
						'message-actions',
						'marking-messages-as-read',
						'marking-messages-as-unread',
						'configure-unread-message-counters',
						'emoji-reactions',
						'view-your-mentions',
						'star-a-message',
						'view-images-and-videos',
						'view-messages-sent-by-a-user',
						'link-to-a-message-or-conversation',
						'search-for-messages',
						'printing-messages',
						'view-the-markdown-source-of-a-message',
						'view-the-exact-time-a-message-was-sent',
						'view-a-messages-edit-history',
						'collapse-a-message',
						'read-receipts'
					]
				},
				{
					label: 'People',
					items: [
						'user-list',
						'status-and-availability',
						'user-cards',
						'view-someones-profile',
						'direct-messages',
						'user-groups',
						'find-administrators',
					]
				},
				{
					label: 'Channels',
					items: [
						'introduction-to-channels',
						'create-a-channel',
						'pin-a-channel',
						'change-the-color-of-a-channel',
						'unsubscribe-from-a-channel',
						'manage-inactive-channels',
						'move-content-to-another-channel',
						'view-channel-subscribers',
					]
				},
				{
					label: 'Topics',
					items: [
						'introduction-to-topics',
						'rename-a-topic',
						'resolve-a-topic',
						'move-content-to-another-topic',
						'delete-a-topic',
					]
				},
				{
					label: 'Notifications',
					items: [
						'channel-notifications',
						'topic-notifications',
						'follow-a-topic',
						'dm-mention-alert-notifications',
						'mute-a-channel',
						'mute-a-topic',
						'mute-a-user',
						'email-notifications',
						'desktop-notifications',
						'mobile-notifications',
						'do-not-disturb',
					]
				},
				{
					label: 'Apps',
					items: [
						{ 
							'label': 'Download apps for every platform',
							link: 'https://zulip.com/apps/'
						},
						'desktop-app-install-guide',
						'supported-browsers',
						'configure-how-links-open',
						'connect-through-a-proxy',
						'custom-certificates',
					]
				},
				{
					label: 'Zulip Administration',
					link: '#',
					attrs: {
						class: 'non-clickable-sidebar-heading'
					}
				},
				{
					label: 'Organization basics',
					items: [
						'review-your-organization-settings',
						'organization-type',
						'communities-directory',
						'import-from-mattermost',
						'import-from-slack',
						'import-from-rocketchat',
						'configure-authentication-methods',
						'saml-authentication',
						'scim',
						'export-your-organization',
						'change-organization-url',
						'deactivate-your-organization',
						'analytics',
						'linking-to-zulip',
						'gdpr-compliance',
					]
				}, 
				{
					label: 'Users',
					items: [
						'roles-and-permissions',
						'invite-new-users',
						'restrict-account-creation',
						'guest-users',
						'manage-a-user',
						'deactivate-or-reactivate-a-user',
						'custom-profile-fields',
						'configure-default-new-user-settings',
						'configure-organization-language',
						'manage-user-groups',
						'change-a-users-role',
						'change-a-users-name',
						'manage-user-channel-subscriptions',
						'restrict-name-and-email-changes',
						'restrict-profile-picture-changes',
						'restrict-permissions-of-new-members',
					]
				},
				{
					label: 'Channel Management',
					items: [
						'create-a-channel',
						'channel-permissions',
						'public-access-option',
						'channel-posting-policy',
						'configure-who-can-create-channels',
						'configure-who-can-invite-to-channels',
						'add-or-remove-users-from-a-channel',
						'set-default-channels-for-new-users',
						'rename-a-channel',
						'change-the-channel-description',
						'change-the-privacy-of-a-channel',
						'archive-a-channel',
					]
				},
				{
					label: 'Organization Settings',
					items: [
						'custom-emoji',
						'add-a-custom-linkifier',
						'require-topics',
						'restrict-direct-messages',
						'restrict-wildcard-mentions',
						'restrict-moving-messages',
						'restrict-message-editing-and-deletion',
						'disable-message-edit-history',
						'allow-image-link-previews',
						'hide-message-content-in-emails',
						'message-retention-policy',
						'digest-emails',
						'disable-welcome-emails',
						'configure-automated-notices',
						'configure-multi-language-search',				
					]
				},
				{
					label: 'Bots & Integrations',
					items: [
						'bots-overview',
						'integrations-overview',
						'add-a-bot-or-integration',
						'generate-integration-url',
						'edit-a-bot',
						'deactivate-or-reactivate-a-bot',
						'request-an-integration',
						'restrict-bot-creation',
						'view-your-bots',
						'view-all-bots-in-your-organization',
					]
				},
				{
					label: 'Support',
					items: [
						'view-zulip-version',
						'zulip-cloud-billing',
						'self-hosted-billing',
						'support-zulip-project',
						'linking-to-zulip-website',
						'contact-support',
					]
				},
				{
					label: '◀ Back to Zulip',
					link: '../',
				}
			]
		}),
	],
});
