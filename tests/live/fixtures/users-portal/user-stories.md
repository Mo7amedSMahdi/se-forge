# User stories: Users portal (release 1)

## US-1 List users
As an administrator I want to see the users, newest first, so that I can find someone.
- AC1: `GET /v1/users` returns a page of users, newest first, with `nextCursor` (D-007).
- AC2: paging through the list while users are added neither skips nor repeats a user (D-007).

## US-2 Create a user
As an administrator I want to add a user with an email and a display name, so that they can use the portal.
- AC1: a valid email and display name create the user: 201 with the user and a `Location` header.
- AC2: an email already used, in any letter case, is refused with 409; emails are stored in lowercase (D-003).
- AC3: a display name of only spaces, or longer than 100 characters after trimming, is refused with 400 naming `displayName`; names are stored trimmed (D-004).

## US-3 View a user
As an administrator I want to open one user, so that I can check their details.
- AC1: `GET /v1/users/{userId}` returns the user; an unknown id is 404.
