# Emitfy

Official Emitfy API SDK for .NET (OpenAPI-typed).

## Install

```bash
dotnet add package Emitfy
```

## Facade

```csharp
using Emitfy;

var emitfy = new EmitfyClient(
  Environment.GetEnvironmentVariable("EMITFY_API_KEY")!,
  Environment.GetEnvironmentVariable("EMITFY_API_SECRET")!
);

var company = emitfy.Company(Environment.GetEnvironmentVariable("EMITFY_COMPANY_ID")!);
await company.Nfse.CreateAsync(new {
  name = "Consultoria",
  category = "consulting",
  serviceDescription = "Consultoria em tecnologia",
  cityServiceCode = "02800",
  serviceItemCode = "01.05",
  taxes = new { iss = new { rate = 2.9, isWithheld = false } },
  amount = 100,
  borrower = new {
    name = "Cliente LTDA",
    taxId = "12.345.678/0001-90",
    email = "financeiro@cliente.com.br"
  }
});
```

## Typed OpenAPI layer

```csharp
using Emitfy.Generated.Model;

var api = emitfy.WebhooksApi();
await api.WebhooksCreateAsync(new WebhookCreate(
  url: "https://seu-sistema.com/webhooks/emitfy",
  events: new WebhookCreateEvents(...)
));
```

Docs: https://docs.emitfy.com/sdks  
OpenAPI: https://api.emitfy.com/openapi.yaml
