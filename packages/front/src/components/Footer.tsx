import { useTranslation } from 'react-i18next';

interface FooterProps {
	setPage: (page: string) => void;
}

export default function Footer({ setPage }: FooterProps) {
	const { t } = useTranslation();

	const handleClick = (page: string) => (e: React.MouseEvent) => {
		e.preventDefault();
		setPage(page);
	};

	return (
		<footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur border-t border-white/10 py-3 px-4 z-40 mt-[10px]">
			<div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400">
				<span>© {new Date().getFullYear()} ft_transcendence</span>
				<span className="hidden sm:inline">•</span>
				<a 
					href="/privacy" 
					onClick={handleClick('privacy')}
					className="hover:text-white transition-colors"
				>
					{t('legal.privacyPolicyLink', 'Privacy Policy')}
				</a>
				<span>•</span>
				<a 
					href="/terms" 
					onClick={handleClick('terms')}
					className="hover:text-white transition-colors"
				>
					{t('legal.termsOfServiceLink', 'Terms of Service')}
				</a>
			</div>
		</footer>
	);
}
