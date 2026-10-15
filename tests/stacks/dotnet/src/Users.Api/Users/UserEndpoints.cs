using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Users.Api.Data;

namespace Users.Api.Users;

/// <summary>The users feature: one route group per resource, operations named as in the contract.</summary>
public static class UserEndpoints
{
    public static void MapUsers(this IEndpointRouteBuilder app)
    {
        var users = app.MapGroup("/v1/users").WithTags("users");
        users.MapGet("", List).WithName("listUsers");
        users.MapPost("", Create).WithName("createUser");
        users.MapGet("/{userId}", Get).WithName("getUser");
    }

    private sealed record Cursor(DateTime C, Guid I);

    private static async Task<IResult> List(AppDb db, int? limit, string? cursor, CancellationToken ct)
    {
        var size = limit ?? 20;
        if (size is < 1 or > 100) return Problems.Validation([new("limit", "must be between 1 and 100")]);
        var query = db.Users.AsNoTracking().OrderByDescending(u => u.CreatedAt).ThenByDescending(u => u.Id).AsQueryable();
        if (cursor is not null)
        {
            Cursor? after;
            try { after = JsonSerializer.Deserialize<Cursor>(Convert.FromBase64String(cursor)); }
            catch (Exception e) when (e is FormatException or JsonException) { after = null; }
            if (after is null) return Problems.Validation([new("cursor", "is not a cursor from this API")]);
            query = query.Where(u => u.CreatedAt < after.C || (u.CreatedAt == after.C && u.Id.CompareTo(after.I) < 0));
        }
        var rows = await query.Take(size + 1).ToListAsync(ct);
        var page = rows.Take(size).ToList();
        var next = rows.Count > size ? Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new Cursor(page[^1].CreatedAt, page[^1].Id))) : null;
        return TypedResults.Ok(new UserPage(page.Select(UserDto.From).ToList(), next));
    }

    private static async Task<IResult> Create(CreateUser body, AppDb db, CancellationToken ct)
    {
        var errors = new List<FieldError>();
        if (string.IsNullOrWhiteSpace(body.Email) || body.Email.Length > 254 || !new EmailAddressAttribute().IsValid(body.Email)) errors.Add(new("email", "must be a valid email address"));
        if (string.IsNullOrWhiteSpace(body.DisplayName) || body.DisplayName.Length > 100) errors.Add(new("displayName", "is required, at most 100 characters"));
        if (errors.Count > 0) return Problems.Validation(errors);

        var user = new User { Email = body.Email!.ToLowerInvariant(), DisplayName = body.DisplayName! };
        db.Users.Add(user);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return Problems.Of(409, "Email already used", $"A user with email {body.Email} exists.");
        }
        await db.Entry(user).ReloadAsync(ct); // CreatedAt is set by the database
        return TypedResults.Created($"/v1/users/{user.Id}", UserDto.From(user));
    }

    private static async Task<IResult> Get(string userId, AppDb db, CancellationToken ct)
    {
        var user = Guid.TryParse(userId, out var id) ? await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) : null;
        return user is null ? Problems.Of(404, "User not found") : TypedResults.Ok(UserDto.From(user));
    }
}
