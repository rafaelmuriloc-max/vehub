

# Fix message signatures to follow visual position

## Root cause
In `MessageArea.tsx` line 156, `senderName` is passed based on `msg.sender_id === currentUserId`. But message positioning in `MessageBubble.tsx` is based on `messageType` (outgoing → right, incoming → left). These two criteria can be out of sync:
- Incoming messages (`whatsapp_incoming`) with `sender_id === currentUserId` → shown LEFT but get signature (wrong)
- Outgoing messages (`whatsapp_outgoing`) with `sender_id !== currentUserId` → shown RIGHT but no signature (wrong)

## Fix
In `MessageArea.tsx`, replicate the same `showOnRight` logic from `MessageBubble` to decide when to pass `senderName`:

```typescript
// Line 149-160 in MessageArea.tsx
{group.msgs.map(msg => {
  const isIncoming = msg.message_type === 'whatsapp_incoming' || msg.message_type === 'whatsapp_image' || msg.message_type === 'whatsapp_video' || msg.message_type === 'whatsapp_audio' || msg.message_type === 'whatsapp_document';
  const isOutgoing = msg.message_type === 'whatsapp_outgoing' || msg.message_type === 'whatsapp';
  const showOnRight = isOutgoing || (msg.sender_id === currentUserId && !isIncoming);
  
  return (
    <MessageBubble
      key={msg.id}
      ...
      senderName={showOnRight ? msg.sender_name : undefined}
    />
  );
})}
```

This ensures:
- Messages on the RIGHT (outgoing) always show the sender's name as signature
- Messages on the LEFT (incoming) never show a signature

## Files
| File | Change |
|------|--------|
| `src/components/chat/MessageArea.tsx` | ~8 lines — compute `showOnRight` and use it for `senderName` |

