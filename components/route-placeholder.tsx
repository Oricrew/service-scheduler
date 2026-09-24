import { Card, CardHeader } from "@/components/ui";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
}: RoutePlaceholderProps) {
  return (
    <Card>
      <CardHeader
        eyebrow={eyebrow}
        title={title}
        titleAs="h1"
        description={description}
      />
    </Card>
  );
}
