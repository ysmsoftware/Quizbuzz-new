# Messaging & Template Management System

## Overview
A comprehensive messaging system for Quiz Pro that allows admins to send notifications, manage templates, and track message delivery across multiple channels (WhatsApp, Email).

## Architecture

### Types & Interfaces (`lib/types/index.ts`)
- **MessageChannel**: 'whatsapp' | 'email' | 'both'
- **MessageStatus**: 'draft' | 'scheduled' | 'sent' | 'failed'
- **SystemEventType**: Pre-defined events (registration_confirmed, day_before_reminder, etc.)
- **RecipientFilter**: 'all' | 'confirmed' | 'paid' | 'custom'
- **MessageTemplate**: Reusable message templates with variables
- **MessageDraft**: In-progress messages before sending
- **SentMessage**: Delivery tracking for sent messages

### Services

#### Message Service (`lib/services/message-service.ts`)
Main service for message operations:
- `getTemplates(contestId)` - Fetch organization and contest templates
- `createTemplate(template)` - Create new message templates
- `updateTemplate(id, updates)` - Update template content
- `deleteTemplate(id)` - Remove templates
- `sendMessage(draft)` - Send message to recipients
- `scheduleMessage(draft, scheduledFor)` - Schedule message delivery
- `getSentMessages(contestId, filters)` - Fetch sent message history
- `getScheduledMessages(contestId)` - Get upcoming scheduled messages
- `getRecipients(contestId, filter)` - Get filtered recipient list
- `cancelScheduledMessage(id)` - Cancel scheduled message

### Custom Hooks

#### `useMessageTemplates`
- Fetches and manages message templates
- Supports create, update, delete operations
- Caches system templates

#### `useMessageSending`
- Handles message composition and sending
- Validates recipients and templates
- Tracks sending state and errors

#### `useSentMessages`
- Displays sent message history
- Supports filtering by channel, status, date
- Shows delivery statistics

#### `useScheduledMessages`
- Manages scheduled messages
- Displays upcoming sends
- Supports cancellation

#### `useRecipientFilter`
- Calculates recipient counts based on filters
- Supports dynamic filtering logic
- Integrates with registration data

### UI Components

#### `VariableInserter`
Chip-based component for inserting template variables. Shows available variables like `{participantName}`, `{contestTitle}`, etc.

#### `MessagePreview`
Displays live preview of messages:
- WhatsApp bubble style for WhatsApp channel
- Email card style for email channel
- Auto-replaces variables with sample data

#### `TemplateBuilder`
Modal for creating/editing templates:
- Channel selection
- Template body editor
- Variable inserter integration
- Live preview panel

#### `TemplateCard`
Card component displaying template:
- Name and channel badge
- Variables list
- System template indicator
- Edit/Delete actions

#### `RecipientSelector`
Filter selection for recipients:
- All Participants
- Confirmed Only
- Paid Only
- Custom Filter

#### `ChannelSelector`
Multi-channel selection:
- WhatsApp
- Email
- Both (sends on both channels)

#### `ScheduleToggle`
Schedule message sending:
- Date & time picker
- Send immediately toggle
- Timezone support

#### `SentHistoryTable`
Virtualized table of sent messages:
- Columns: Template, Channel, Recipients, Delivered, Failed, Status, Time
- Sorting & filtering
- Delivery rate indicators
- Pagination with infinite scroll

#### `ScheduledMessagesTable`
Virtualized table of scheduled messages:
- Columns: Template, Channel, Scheduled Time, Recipients, Status, Actions
- Cancel button for upcoming sends
- Time-based sorting

### Admin Pages

#### Messages Page (`/admin/contests/[id]/messages`)
Main messaging interface with 4 tabs:

1. **Send Message**
   - Template selection from dropdown
   - Channel selector
   - Recipient filter with count
   - Schedule toggle
   - Preview panel
   - Send/Schedule button

2. **Scheduled Messages**
   - Table of upcoming sends
   - Cancel button
   - Next send time countdown

3. **Sent History**
   - Searchable table of sent messages
   - Delivery statistics
   - Filter by channel/date

4. **Templates**
   - Link to org-wide templates
   - Quick create button
   - Recent templates list

#### Templates Page (`/admin/messages/templates`)
Organization-wide template management:
- Grid of all templates
- System templates (read-only, marked as System)
- User-created templates (editable/deletable)
- Create New Template modal
- Search and filter by channel

## System Templates

Pre-configured templates for automatic events:
1. **Registration Confirmed** - Sent after successful registration
2. **Day Before Reminder** - 24 hours before contest
3. **Hour Reminder** - 1 hour before contest start
4. **Contest Started** - When contest begins
5. **Results Published** - When results are available
6. **Certificate Ready** - When certificate is generated

## Features

### Template Variables
Support for dynamic content:
- `{participantName}` - Participant's full name
- `{participantId}` - Unique participant ID
- `{contestTitle}` - Contest name
- `{contestDate}` - Contest date/time
- `{registrationLink}` - Registration URL
- `{resultLink}` - Results URL
- `{certificateLink}` - Certificate download link

### Multi-Channel Messaging
- **WhatsApp**: Message formatting optimized for WhatsApp
- **Email**: HTML email templates
- **Both**: Single action sends on both channels

### Recipient Filtering
Smart filtering based on registration data:
- **All**: All registered participants
- **Confirmed**: Only those with confirmed email/phone
- **Paid**: Only those with successful payment
- **Custom**: Advanced filtering (city, state, institution, etc.)

### Message Scheduling
- Schedule messages for future delivery
- Show delivery countdown in admin
- Automatic delivery at scheduled time
- Cancel scheduled messages before send

### Delivery Tracking
- Track successful deliveries
- Count failed messages
- Show delivery rate percentage
- Filter history by status

## Integration Points

### With Contest Data
- Links contest templates to contest
- Filters recipients based on contest registrations
- Includes contest info in template variables

### With Registration Service
- Uses registration data for recipient filtering
- Accesses contact information (email, phone)
- Filters by payment and confirmation status

### With User System
- Templates are org-owned
- Admin authentication required
- Audit trail for template changes

## Usage Examples

### Send Immediate Message
1. Go to `/admin/contests/[id]/messages`
2. Select template from dropdown
3. Choose channel (WhatsApp/Email/Both)
4. Select recipient filter
5. Click "Send Immediately"

### Schedule a Message
1. Follow steps 1-4 above
2. Toggle "Schedule for later"
3. Pick date and time
4. Click "Schedule Message"
5. View in "Scheduled Messages" tab

### Create Custom Template
1. Go to `/admin/messages/templates`
2. Click "New Template"
3. Fill template name, channel, body
4. Use variable inserter to add `{variables}`
5. Save template

### System Templates
System templates are automatically created and cannot be deleted. They trigger based on events:
- Admin can edit the content
- Messages automatically sent at trigger time
- Can be disabled by updating content

## Performance Optimizations

- **Virtual Scrolling**: Tables use TanStack Virtual for large datasets
- **Template Caching**: In-memory cache of templates
- **Debounced Search**: Prevents excessive filtering
- **Lazy Loading**: Templates load on demand
- **Batch Operations**: Upcoming feature for bulk messaging

## Future Enhancements

- SMS channel support
- Webhook delivery notifications
- Template versioning
- A/B testing variants
- Attachment support (PDFs, images)
- Bulk template upload
- Message analytics dashboard
