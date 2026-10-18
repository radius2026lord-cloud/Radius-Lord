-- Apply to lord_radius_core after 20261007_central_environment_architecture.sql.
-- Reserve actual OVPN identities and certificates centrally before a tenant NAS exists.
ALTER TABLE nas_tunnels
  ADD COLUMN reservation_slot SMALLINT UNSIGNED NULL AFTER tenant_nas_id,
  ADD UNIQUE KEY uq_tunnel_environment_slot (environment_id,reservation_slot);
