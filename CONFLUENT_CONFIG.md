# Confluent Cloud Configuration

## Correct `.env.local` Configuration

For **Confluent Cloud**, use this format (CONFLUENT_* variables):

```bash
CONFLUENT_BOOTSTRAP_SERVERS=pkc-xxxxx.region.provider.confluent.cloud:9092
CONFLUENT_API_KEY=your_api_key_here
CONFLUENT_API_SECRET=your_api_secret_here
CONFLUENT_SECURITY_PROTOCOL=SASL_SSL
CONFLUENT_SASL_MECHANISM=PLAIN
```

**Note:** The server code supports both `CONFLUENT_*` and `KAFKA_*` environment variables. `CONFLUENT_*` takes precedence if both are present.

## How to Get Confluent Cloud Credentials

1. **Go to Confluent Cloud Console**: https://confluent.cloud
2. **Select your cluster**
3. **Navigate to**: Cluster Settings → **API Keys**
4. **Create a new API key** (or use existing):
   - Click "Add Key"
   - Select "Global access" or specific cluster
   - Copy the credentials

5. **Get Bootstrap Server**:
   - Go to **Cluster Settings** → **Cluster Overview**
   - Find "Bootstrap server" (format: `pkc-xxxxx.region.provider.confluent.cloud:9092`)
   - Copy this to `KAFKA_BROKERS`

## Example Configuration

```bash
# Example Confluent Cloud config
CONFLUENT_BOOTSTRAP_SERVERS=pkc-12345.us-west-2.aws.confluent.cloud:9092
CONFLUENT_API_KEY=ABC123XYZ789
CONFLUENT_API_SECRET=secret_key_here_abc123xyz789
CONFLUENT_SECURITY_PROTOCOL=SASL_SSL
CONFLUENT_SASL_MECHANISM=PLAIN
```

## Important Notes

- ✅ **CONFLUENT_SECURITY_PROTOCOL** must be `SASL_SSL` for Confluent Cloud
- ✅ **CONFLUENT_BOOTSTRAP_SERVERS** format: `pkc-xxxxx.region.provider.confluent.cloud:9092`
- ✅ **CONFLUENT_API_KEY** = API Key (not your Confluent Cloud login email)
- ✅ **CONFLUENT_API_SECRET** = API Secret (the secret key, not password)
- ✅ **CONFLUENT_SASL_MECHANISM** = `PLAIN` (default, already set)
- ✅ Make sure the topic `seedcore.hotel.events` exists in your cluster
- ✅ The server code automatically maps `CONFLUENT_*` to KafkaJS configuration

## Create the Topic

Before using, create the topic in Confluent Cloud:

1. Go to **Topics** → **Add Topic**
2. Name: `seedcore.hotel.events`
3. Partitions: 6 (recommended for ordering)
4. Replication: 3 (default)

## Testing Connection

After updating `.env.local`, restart the server:

```bash
npm run dev:server
```

Look for:
```
[Kafka] ✅ Connected to brokers: [ 'pkc-xxxxx...' ]
```

If you see connection errors, check:
- ✅ Bootstrap server URL is correct
- ✅ API key/secret are correct
- ✅ SSL is set to `true`
- ✅ Topic `seedcore.hotel.events` exists

