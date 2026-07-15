using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Emitfy;

public sealed class EmitfyException : Exception
{
    public string? Code { get; }
    public object? Details { get; }
    public int StatusCode { get; }

    public EmitfyException(string message, string? code, object? details, int statusCode)
        : base(message)
    {
        Code = code;
        Details = details;
        StatusCode = statusCode;
    }
}

public sealed class EmitfyClient
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly int _maxRetries;
    private readonly string _apiKey;
    private readonly string _apiSecret;

    public WebhooksResource Webhooks { get; }
    public CompaniesResource Companies { get; }

    public EmitfyClient(string apiKey, string apiSecret, string? baseUrl = null, int maxRetries = 2, HttpClient? httpClient = null)
    {
        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret))
        {
            throw new EmitfyException("apiKey and apiSecret are required.", null, null, 0);
        }

        _apiKey = apiKey.Trim();
        _apiSecret = apiSecret.Trim();
        _baseUrl = (baseUrl ?? "https://api.emitfy.com/v1").TrimEnd('/');
        _maxRetries = maxRetries;
        _http = httpClient ?? new HttpClient();
        _http.DefaultRequestHeaders.Remove("X-Api-Key");
        _http.DefaultRequestHeaders.Remove("X-Api-Secret");
        _http.DefaultRequestHeaders.TryAddWithoutValidation("X-Api-Key", _apiKey);
        _http.DefaultRequestHeaders.TryAddWithoutValidation("X-Api-Secret", _apiSecret);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        Webhooks = new WebhooksResource(this);
        Companies = new CompaniesResource(this);
    }

    /// <summary>Configuração do client OpenAPI tipado (<c>Emitfy.Generated.*</c>).</summary>
    public Emitfy.Generated.Client.Configuration OpenApiConfiguration()
    {
        var config = new Emitfy.Generated.Client.Configuration
        {
            BasePath = _baseUrl
        };
        config.AddApiKey("X-Api-Key", _apiKey);
        config.AddApiKey("X-Api-Secret", _apiSecret);
        return config;
    }

    /// <summary>API tipada de webhooks gerada do OpenAPI.</summary>
    public Emitfy.Generated.Api.WebhooksApi WebhooksApi() =>
        new Emitfy.Generated.Api.WebhooksApi(OpenApiConfiguration());

    public CompanyContext Company(string companyId)
    {
        if (string.IsNullOrWhiteSpace(companyId))
        {
            throw new EmitfyException("companyId is required.", null, null, 0);
        }

        return new CompanyContext(this, companyId.Trim());
    }

    internal async Task<JsonElement?> RequestAsync(HttpMethod method, string path, object? body = null, string? idempotencyKey = null, CancellationToken ct = default)
    {
        var attempt = 0;

        while (true)
        {
            attempt++;
            using var request = new HttpRequestMessage(method, $"{_baseUrl}/{path.TrimStart('/')}");

            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
            }

            if (body != null)
            {
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            }

            using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
            var text = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if ((int)response.StatusCode == 429 && attempt <= _maxRetries + 1)
            {
                var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 1;
                await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, retryAfter)), ct).ConfigureAwait(false);
                continue;
            }

            using var doc = string.IsNullOrWhiteSpace(text) ? null : JsonDocument.Parse(text);

            if (!response.IsSuccessStatusCode)
            {
                string message = "Request failed.";
                string? code = null;
                object? details = null;

                if (doc?.RootElement.TryGetProperty("error", out var error) == true)
                {
                    if (error.TryGetProperty("message", out var msg))
                    {
                        message = msg.GetString() ?? message;
                    }

                    if (error.TryGetProperty("code", out var codeEl))
                    {
                        code = codeEl.GetString();
                    }

                    if (error.TryGetProperty("details", out var detailsEl))
                    {
                        details = detailsEl.Clone();
                    }
                }

                throw new EmitfyException(message, code, details, (int)response.StatusCode);
            }

            if (doc?.RootElement.TryGetProperty("data", out var data) == true)
            {
                return data.Clone();
            }

            return doc?.RootElement.Clone();
        }
    }
}

public sealed class WebhooksResource
{
    private readonly EmitfyClient _client;

    internal WebhooksResource(EmitfyClient client) => _client = client;

    public Task<JsonElement?> ListAsync(CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Get, "/webhooks", ct: ct);

    public Task<JsonElement?> CreateAsync(object payload, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Post, "/webhooks", payload, ct: ct);

    public Task<JsonElement?> UpdateAsync(string id, object payload, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Put, $"/webhooks/{Uri.EscapeDataString(id)}", payload, ct: ct);

    public Task<JsonElement?> SetActiveAsync(string id, bool active, CancellationToken ct = default) =>
        _client.RequestAsync(new HttpMethod("PATCH"), $"/webhooks/{Uri.EscapeDataString(id)}/active", new { active }, ct: ct);

    public Task<JsonElement?> DeleteAsync(string id, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Delete, $"/webhooks/{Uri.EscapeDataString(id)}", ct: ct);
}

public sealed class CompaniesResource
{
    private readonly EmitfyClient _client;

    internal CompaniesResource(EmitfyClient client) => _client = client;

    public Task<JsonElement?> ListAsync(CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Get, "/companies", ct: ct);

    public Task<JsonElement?> CreateAsync(object payload, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Post, "/companies", payload, ct: ct);
}

public sealed class CompanyResource
{
    private readonly EmitfyClient _client;
    private readonly string _basePath;

    internal CompanyResource(EmitfyClient client, string basePath)
    {
        _client = client;
        _basePath = basePath;
    }

    public Task<JsonElement?> ListAsync(CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Get, _basePath, ct: ct);

    public Task<JsonElement?> CreateAsync(object payload, string? idempotencyKey = null, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Post, _basePath, payload, idempotencyKey, ct);

    public Task<JsonElement?> GetAsync(string id, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Get, $"{_basePath}/{Uri.EscapeDataString(id)}", ct: ct);

    public Task<JsonElement?> UpdateAsync(string id, object payload, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Put, $"{_basePath}/{Uri.EscapeDataString(id)}", payload, ct: ct);

    public Task<JsonElement?> DeleteAsync(string id, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Delete, $"{_basePath}/{Uri.EscapeDataString(id)}", ct: ct);

    public Task<JsonElement?> PostAsync(string suffix, object? payload = null, string? idempotencyKey = null, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Post, $"{_basePath.TrimEnd('/')}/{suffix.TrimStart('/')}", payload, idempotencyKey, ct);
}

public sealed class CompanyContext
{
    private readonly EmitfyClient _client;
    private readonly string _companyId;

    public CompanyResource Nfse { get; }
    public CompanyResource Nfe { get; }
    public CompanyResource Nfce { get; }
    public CompanyResource Cte { get; }
    public CompanyResource Customers { get; }
    public CompanyResource Products { get; }
    public CompanyResource Sales { get; }
    public CompanyResource Invoices { get; }
    public CompanyResource ReceivedNfes { get; }

    internal CompanyContext(EmitfyClient client, string companyId)
    {
        _client = client;
        _companyId = companyId;
        var prefix = $"/companies/{Uri.EscapeDataString(companyId)}";
        Nfse = new CompanyResource(client, $"{prefix}/nfse");
        Nfe = new CompanyResource(client, $"{prefix}/nfe");
        Nfce = new CompanyResource(client, $"{prefix}/nfce");
        Cte = new CompanyResource(client, $"{prefix}/cte");
        Customers = new CompanyResource(client, $"{prefix}/customers");
        Products = new CompanyResource(client, $"{prefix}/products");
        Sales = new CompanyResource(client, $"{prefix}/sales");
        Invoices = new CompanyResource(client, $"{prefix}/invoices");
        ReceivedNfes = new CompanyResource(client, $"{prefix}/received-nfes");
    }

    public string Id() => _companyId;

    public Task<JsonElement?> CreateCteOsAsync(object payload, string? idempotencyKey = null, CancellationToken ct = default) =>
        _client.RequestAsync(HttpMethod.Post, $"/companies/{Uri.EscapeDataString(_companyId)}/cte-os", payload, idempotencyKey, ct);
}
