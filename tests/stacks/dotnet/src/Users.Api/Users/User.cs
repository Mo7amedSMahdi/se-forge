namespace Users.Api.Users;

public enum UserStatus { ACTIVE, SUSPENDED }

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public UserStatus Status { get; set; } = UserStatus.ACTIVE;
    public DateTime CreatedAt { get; set; }
}

// API shapes: camelCase JSON by default in minimal APIs.
public sealed record CreateUser(string? Email, string? DisplayName);
public sealed record UserDto(string Id, string Email, string DisplayName, UserStatus Status, DateTime CreatedAt)
{
    public static UserDto From(User u) => new(u.Id.ToString(), u.Email, u.DisplayName, u.Status, DateTime.SpecifyKind(u.CreatedAt, DateTimeKind.Utc));
}
public sealed record UserPage(IReadOnlyList<UserDto> Items, string? NextCursor);
