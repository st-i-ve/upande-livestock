import React from "react";

import { Avatar, type AvatarTone } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { allAlerts } from "@/data/mock";

export default function Alerts() {
  return (
    <Screen title="Action queue" subtitle="5 items need attention">
      {allAlerts.map((a, i) => (
        <Row
          key={i}
          left={<Avatar icon={a.ic as any} tone={a.sev as AvatarTone} />}
          title={a.t}
          meta={a.s}
          right={<Button label="Resolve" variant="link" />}
        />
      ))}
    </Screen>
  );
}
