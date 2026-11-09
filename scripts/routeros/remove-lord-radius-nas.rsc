# Run on the customer NAS only, never on the central CHR.
# Removes managed objects, disconnecting the NAS from Radius Lord.
# Shared CA certificates and global API/PPP/CoA/clock settings are retained.
{
    :local deleteApiUser false

    /system scheduler remove [find where comment="Lord_Radius"]
    /system scheduler remove [find where comment~"^Lord_Rdius-Cloud"]
    /system script remove [find where comment="Lord_Radius"]
    /system script remove [find where comment~"^Lord_Rdius-Cloud"]

    /radius remove [find where comment="Lord_Radius"]
    /radius remove [find where comment~"^Radius_Lord_Direct_N[0-9]+\$"]
    /radius remove [find where comment~"^Lord_Rdius-Cloud"]

    :foreach tag in={"Lord_Radius";"Lord_Radius_API"} do={
        /ip route remove [find where comment=$tag]
        /ip firewall filter remove [find where comment=$tag]
        /ip firewall nat remove [find where comment=$tag]
        /ip firewall mangle remove [find where comment=$tag]
        /ip firewall raw remove [find where comment=$tag]
    }
    /ip route remove [find where comment~"^Lord_Rdius-Cloud"]
    /ip firewall filter remove [find where comment~"^Lord_Rdius-Cloud"]
    /ip firewall nat remove [find where comment~"^Lord_Rdius-Cloud"]
    /ip firewall mangle remove [find where comment~"^Lord_Rdius-Cloud"]
    /ip firewall raw remove [find where comment~"^Lord_Rdius-Cloud"]

    /interface ovpn-client remove [find where comment="Lord_Radius"]
    /interface ovpn-client remove [find where comment~"^network_N[0-9]+\$"]
    /interface ovpn-client remove [find where comment~"^Lord_Rdius-Cloud"]

    :foreach certId in=[/certificate find] do={
        :local cn [/certificate get $certId common-name]
        :local usage [:tostr [/certificate get $certId key-usage]]
        :local certName [/certificate get $certId name]
        :if (($cn ~ "^(lord_N[0-9]+_[0-9]+|lord_[0-9]+|rl_env_[0-9]+_nas_[0-9]+)\$") && ($usage ~ "tls-client") && !($usage ~ "key-cert-sign")) do={
            :if ([:len [/interface ovpn-client find where certificate=$certName]] = 0) do={
                /certificate remove $certId
            }
        }
    }

    :foreach fileId in=[/file find] do={
        :local fileName [/file get $fileId name]
        :if ($fileName ~ "^(lord_N[0-9]+_[0-9]+|lord_[0-9]+|rl_env_[0-9]+_nas_[0-9]+)_(ca|client|key)[.]txt\$") do={
            /file remove $fileId
        }
    }

    # Enable only if these API users were originally created by the importer.
    :if ($deleteApiUser = true) do={
        /user remove [find where name="lord" and comment="Lord_Radius"]
        /user remove [find where comment~"^Radius_Lord_Direct_N[0-9]+\$"]
        /user remove [find where comment~"^Lord_Rdius-Cloud"]
    }
    :put "Lord_Rdius-Cloud managed NAS items removed."
}
