import { Href, Link, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  const router = useRouter();

  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent default browser opening
          event.preventDefault();
          // Open inside our own superapp browser screen
          router.push({
            pathname: '/browser',
            params: { url: href }
          });
        }
      }}
    />
  );
}

