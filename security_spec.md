# SnapStudy Security Specification

## 1. Data Invariants
- **User Profile**: Every user must have a profile indexed by their `uid`. Users can only manage their own profile.
- **Study Guide**: Must be stored under `users/{userId}/studyGuides/{guideId}`.
- **Ownership**: `resource.data.userId` (if present) must match the path `userId` and `request.auth.uid`.
- **Integrity**: 
  - `title` must be a string <= 200 chars.
  - `flashcards` must be a list of flashcard objects.
  - `quiz` must be a list of quiz questions.
  - `createdAt` is immutable after creation.
  - `updatedAt` (if used) must be current server time.

## 2. The "Dirty Dozen" Payloads

| Payload ID | Target Operation | Description | Expected Result |
|------------|------------------|-------------|-----------------|
| P1 | Create | Create guide in `/users/VICTIM_UID/studyGuides/1` | DENY |
| P2 | Create | Create guide with `userId` = "OTHER_UID" | DENY |
| P3 | Create | Create guide with `title` = "A" * 10000 | DENY |
| P4 | Update | Change `userId` of an existing guide | DENY |
| P5 | Update | Manually set `createdAt` on update | DENY |
| P6 | Update | Add `isAdmin: true` to a guide document | DENY |
| P7 | Read | `get` on `/users/VICTIM_UID/studyGuides/ANY` | DENY |
| P8 | Delete | `delete` on `/users/VICTIM_UID/studyGuides/ANY` | DENY |
| P9 | Create | Create user profile in `/users/VICTIM_UID` | DENY |
| P10 | Update | Update `uid` field in user profile | DENY |
| P11 | Create | Create guide with `flashcards` = [] | DENY |
| P12 | List | Query `collectionGroup('studyGuides')` | DENY |

## 3. Implementation Plan
- Default deny all.
- Use `isValidId` for all path variables.
- Use `isValidStudyGuide` and `isValidUser` helpers.
- Enforce server timestamps for `createdAt`.
- Enforce `affectedKeys().hasOnly()` on updates.
