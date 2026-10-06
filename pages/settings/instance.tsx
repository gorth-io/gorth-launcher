import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/layouts/page-shell";
import { InstanceSettingsForm } from "@/components/form/instance-settings-form";
import type {
  AccountView,
  Instance,
  InstanceSettings,
} from "@/lib/utils/interface";

export function InstancePreferencesPage({
  instances,
  settings,
  accounts,
  busy,
  onSave,
  onEdit,
}: {
  instances: Instance[];
  settings: Record<string, InstanceSettings>;
  accounts: AccountView[];
  busy: boolean;
  onSave: (id: string, value: InstanceSettings) => Promise<boolean>;
  onEdit: (item: Instance) => void;
}) {
  const [id, setId] = useState("");
  const selected = instances.find((item) => item.id === id) ?? instances[0];
  return (
    <PageShell
      aside={
        <Card>
          <CardHeader>
            <CardTitle>Instance Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              RAM, Java, JVM, resolution, account, GPU and launch commands.
            </p>
            <NativeSelect
              aria-label="Chọn instance cấu hình"
              value={selected?.id ?? ""}
              onChange={(event) => setId(event.target.value)}
            >
              {!instances.length && (
                <NativeSelectOption value="">
                  Chưa có instance
                </NativeSelectOption>
              )}
              {instances.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {selected && (
              <Button
                className="h-9 w-full"
                variant="outline"
                onClick={() => onEdit(selected)}
              >
                Đổi tên, version và loader
              </Button>
            )}
          </CardContent>
        </Card>
      }
    >
      {selected && settings[selected.id] ? (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <InstanceSettingsForm
              key={selected.id}
              expanded
              initialSettings={settings[selected.id]}
              accounts={accounts}
              busy={busy}
              onSave={(value) => onSave(selected.id, value)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Tạo instance trước khi chỉnh cấu hình riêng.
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
