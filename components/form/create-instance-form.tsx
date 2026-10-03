import { useForm } from "@tanstack/react-form";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loaderCatalog, supportedLoader } from "@/lib/game/catalog";

interface CreateInstanceFormProps {
  versions: { id: string }[];
  onCancel: () => void;
  onSubmit: (value: {
    name: string;
    version: string;
    loader: string;
    loaderVersion: string | null;
  }) => void;
}

export function CreateInstanceForm({
  versions,
  onCancel,
  onSubmit,
}: CreateInstanceFormProps) {
  const vanillaVersions = versions.length ? versions : [{ id: "1.20.1" }];
  const form = useForm({
    defaultValues: {
      name: "",
      version: "1.20.1",
      loader: "Vanilla",
      loaderVersion: "",
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      const version = value.version.trim();
      const listedVersion = value.loader !== "Vanilla" ||
        vanillaVersions.some((entry) => entry.id === version);
      if (name && version && listedVersion && supportedLoader(value))
        onSubmit({
          name,
          version,
          loader: value.loader,
          loaderVersion: value.loaderVersion || null,
        });
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2 id="instance-dialog-title">Tạo instance mới</h2>
      <p className="text-sm text-muted-foreground">
        Một không gian riêng cho phiên bản Minecraft của bạn.
      </p>
      <form.Field name="name">
        {(field) => (
          <label>
            Tên instance
            <Input
              autoFocus
              maxLength={60}
              placeholder="Thế giới của tôi"
              required
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="loader">
        {(field) => (
          <label>
            Mod loader
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={field.state.value}
              onChange={(event) => {
                const loader = event.target.value;
                field.handleChange(loader);
                const preset = loaderCatalog.find(
                  (entry) => entry.loader === loader,
                );
                form.setFieldValue("version", preset?.minecraft ?? "1.20.1");
                form.setFieldValue("loaderVersion", preset?.version ?? "");
              }}
            >
              {["Vanilla", "Fabric", "Forge", "NeoForge"].map((loader) => (
                <option key={loader}>{loader}</option>
              ))}
            </select>
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.loader}>
        {(loader) => (
          <>
            <form.Field name="version">
              {(field) => (
                <label>
                  Phiên bản Minecraft
                  {loader === "Vanilla" ? (
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      required
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    >
                      {vanillaVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={field.state.value}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        form.setFieldValue(
                          "loaderVersion",
                          loaderCatalog.find(
                            (entry) =>
                              entry.loader === loader &&
                              entry.minecraft === event.target.value,
                          )!.version,
                        );
                      }}
                    >
                      {[
                        ...new Set(
                          loaderCatalog
                            .filter((entry) => entry.loader === loader)
                            .map((entry) => entry.minecraft),
                        ),
                      ].map((minecraft) => (
                        <option key={minecraft} value={minecraft}>
                          {minecraft}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              )}
            </form.Field>
            {loader !== "Vanilla" && (
              <form.Field name="loaderVersion">
                {(field) => (
                  <label>
                    Phiên bản loader ổn định
                    <form.Subscribe selector={(state) => state.values.version}>
                      {(minecraft) => (
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                        >
                          {loaderCatalog
                            .filter(
                              (entry) =>
                                entry.loader === loader &&
                                entry.minecraft === minecraft,
                            )
                            .map((entry) => (
                              <option key={entry.version} value={entry.version}>
                                {entry.version}
                              </option>
                            ))}
                        </select>
                      )}
                    </form.Subscribe>
                  </label>
                )}
              </form.Field>
            )}
          </>
        )}
      </form.Subscribe>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Vanilla: tất cả bản release từ 1.7.10 đến mới nhất, không gồm snapshot. Mod
        loader: danh sách ghim ổn định, không dùng Quilt. Temurin được tự chọn
        theo phiên bản game; 1.20.1 dùng Java 17, 1.21.1 dùng Java 21.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button type="submit" className="h-9">
          <Plus size={16} />
          Tạo instance
        </Button>
      </div>
    </form>
  );
}
