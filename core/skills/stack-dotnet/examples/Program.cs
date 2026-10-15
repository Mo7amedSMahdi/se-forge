using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Users.Api;
using Users.Api.Data;
using Users.Api.Users;

var builder = WebApplication.CreateBuilder(args);

// The connection string comes from the environment (ConnectionStrings__Default), never from a committed file.
builder.Services.AddDbContext<AppDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemExceptionHandler>();
builder.Services.Configure<JsonOptions>(o =>
{
    o.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow; // additionalProperties: false
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
// Bad JSON or unknown fields throw, so the exception handler can answer with the team's problem shape.
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.MapUsers();
app.Run();

public partial class Program;
