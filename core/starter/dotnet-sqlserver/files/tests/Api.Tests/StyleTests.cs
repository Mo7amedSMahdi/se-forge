using System.Net;
using System.Text.Json;

namespace Api.Tests;

/// <summary>The health route and the team's error shape (decisions 33, 81): keep these green.</summary>
public sealed class StyleTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Health_answers_ok()
    {
        var r = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("ok", JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Unknown_route_is_a_404_problem()
    {
        var r = await _client.GetAsync("/v1/no-such-route");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        Assert.Equal(404, JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Wrong_method_is_a_405_problem()
    {
        var r = await _client.PostAsync("/health", null);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
    }
}
