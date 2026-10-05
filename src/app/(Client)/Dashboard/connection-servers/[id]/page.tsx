"use client";
import { useParams, useSearchParams } from "next/navigation";
import OvpnGatewayForm from "@/components/settings/ovpn-gateway-form";
export default function GatewayPage(){const params=useParams(),search=useSearchParams();return <OvpnGatewayForm gatewayId={Number(params.id)} viewOnly={search.get('view')==='1'}/>;}
