using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Users.Api.Data;

namespace Users.Api.Tests;

/// <summary>API tests per status code of the contract (tests/stacks/contract/users.yaml).</summary>
public sealed class UsersApiTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Problem = "application/problem+json";
    private readonly HttpClient _client = api.CreateClient();

    private async Task<JsonElement> Create(string email, string name = "Amal")
    {
        var r = await _client.PostAsJsonAsync("/v1/users", new { email, displayName = name });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        return await r.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task Create_returns_201_with_location_and_camel_case()
    {
        var r = await _client.PostAsJsonAsync("/v1/users", new { email = "Amal@Example.com", displayName = "Amal" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal($"/v1/users/{body.GetProperty("id").GetString()}", r.Headers.Location?.ToString());
        Assert.Equal("amal@example.com", body.GetProperty("email").GetString());
        Assert.Equal("ACTIVE", body.GetProperty("status").GetString());
        Assert.EndsWith("Z", body.GetProperty("createdAt").GetString());
    }

    [Fact]
    public async Task Duplicate_email_is_409_problem()
    {
        await Create("dup@example.com");
        var r = await _client.PostAsJsonAsync("/v1/users", new { email = "dup@example.com", displayName = "Again" });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal(Problem, r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Invalid_input_is_400_with_field_errors()
    {
        var r = await _client.PostAsJsonAsync("/v1/users", new { email = "not-an-email" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal(Problem, r.Content.Headers.ContentType?.MediaType);
        var fields = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").EnumerateArray().Select(e => e.GetProperty("field").GetString()).ToList();
        Assert.Contains("email", fields);
        Assert.Contains("displayName", fields);
    }

    [Fact]
    public async Task Unknown_field_is_400_with_field_errors()
    {
        var r = await _client.PostAsJsonAsync("/v1/users", new { email = "x@example.com", displayName = "X", role = "admin" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal(Problem, r.Content.Headers.ContentType?.MediaType);
        Assert.Equal("role", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors")[0].GetProperty("field").GetString());
    }

    [Theory]
    [InlineData("3f2504e0-4f89-11d3-9a0c-0305e82c3301")]
    [InlineData("not-a-guid")]
    public async Task Unknown_user_is_404_problem(string id)
    {
        var r = await _client.GetAsync($"/v1/users/{id}");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal(Problem, r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Get_returns_the_user()
    {
        var user = await Create("get@example.com");
        var r = await _client.GetFromJsonAsync<JsonElement>($"/v1/users/{user.GetProperty("id").GetString()}");
        Assert.Equal("get@example.com", r.GetProperty("email").GetString());
    }

    [Fact]
    public async Task List_pages_with_a_cursor_newest_first()
    {
        for (var i = 0; i < 3; i++) await Create($"page{i}@example.com", $"P{i}");
        var seen = new List<string>();
        string? cursor = null;
        do
        {
            var page = await _client.GetFromJsonAsync<JsonElement>($"/v1/users?limit=2{(cursor is null ? "" : $"&cursor={Uri.EscapeDataString(cursor)}")}");
            seen.AddRange(page.GetProperty("items").EnumerateArray().Select(u => u.GetProperty("email").GetString()!));
            cursor = page.GetProperty("nextCursor").GetString();
        } while (cursor is not null);
        Assert.Equal(seen.Count, seen.Distinct().Count());
        Assert.True(seen.IndexOf("page2@example.com") < seen.IndexOf("page0@example.com"), "newest first");
    }

    [Fact]
    public async Task Bad_limit_and_cursor_are_400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/v1/users?limit=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/v1/users?cursor=garbage")).StatusCode);
    }

    [Fact]
    public async Task Raw_sql_binds_interpolated_values_as_parameters()
    {
        const string email = "o'brien@example.com"; // a quote breaks string-built SQL, not a parameter
        await Create(email, "O'Brien");
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var count = await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM Users WHERE Email = {email}").SingleAsync();
        Assert.Equal(1, count);
    }
}
