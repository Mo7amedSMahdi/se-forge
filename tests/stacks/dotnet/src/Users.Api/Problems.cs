using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;

namespace Users.Api;

public sealed record FieldError(string Field, string Message);

/// <summary>RFC 9457 problem details in the team's shape (validation errors as a list of field errors).</summary>
public static class Problems
{
    public static IResult Validation(IEnumerable<FieldError> errors) =>
        TypedResults.Problem(statusCode: 400, title: "Invalid input",
            extensions: new Dictionary<string, object?> { ["errors"] = errors.ToList() });

    public static IResult Of(int status, string title, string? detail = null) =>
        TypedResults.Problem(statusCode: status, title: title, detail: detail);
}

/// <summary>Malformed JSON and unknown fields (BadHttpRequestException) become a 400 with field errors.</summary>
public sealed class ProblemExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        if (exception is not BadHttpRequestException bad) return false;
        var field = bad.InnerException is JsonException json ? (json.Path ?? "$").TrimStart('$', '.') : "body";
        http.Response.StatusCode = StatusCodes.Status400BadRequest;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = { Status = 400, Title = "Invalid input", Extensions = { ["errors"] = new[] { new FieldError(field, "is not valid here") } } },
            Exception = exception,
        });
    }
}
