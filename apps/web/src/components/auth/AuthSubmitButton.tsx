import { Button as HeroButton } from '@heroui/react';
import { EasyvetIcon } from '../icons/EasyvetIcon';

type AuthSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  pending: boolean;
};

// Account forms share a centered, accessible submit control and consistent pending state.
export function AuthSubmitButton({ label, pendingLabel, pending }: AuthSubmitButtonProps) {
  return (
    <HeroButton
      className="button--full login-submit"
      fullWidth
      isDisabled={pending}
      isPending={pending}
      size="lg"
      type="submit"
    >
      <span className="login-submit__content">
        <span>{pending ? pendingLabel : label}</span>
        {!pending ? <EasyvetIcon name="arrow-up-right" size={16} /> : null}
      </span>
    </HeroButton>
  );
}
